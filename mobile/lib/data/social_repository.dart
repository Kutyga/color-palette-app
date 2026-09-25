import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:uuid/uuid.dart';

import '../features/social/domain/social.dart';

/// Лента постов и новости.
abstract interface class SocialRepository {
  Future<List<FeedPost>> feed(FeedTab tab);
  Future<List<NewsArticle>> news({bool onlyMySpecies = false});
  Future<FeedPost> createPost(NewPost post);
  Future<void> setLiked(String postId, bool liked);

  Future<List<PostComment>> comments(String postId);
  Future<PostComment> addComment(String postId, String text);
  Future<void> deleteComment(String commentId);

  /// Для достижений: сколько постов опубликовано и лайков получено.
  Future<({int posts, int likesReceived})> myActivity();
}

class SupabaseSocialRepository implements SocialRepository {
  SupabaseSocialRepository(this._db);

  final SupabaseClient _db;
  static const _uuid = Uuid();
  static const _select = '*, author:profiles!posts_author_id_fkey(username, display_name), plant:plants(nickname)';
  static const _bucket = 'post-photos';

  String get _uid => _db.auth.currentUser!.id;

  @override
  Future<List<FeedPost>> feed(FeedTab tab) async {
    final rows = await _db
        .rpc<List<dynamic>>(tab == FeedTab.following ? 'feed_following' : 'feed_discover', params: {'lim': 30})
        .select(_select);
    return _hydrate(rows.cast<Map<String, dynamic>>());
  }

  /// Подписанные ссылки на фото и отметка «мне нравится».
  Future<List<FeedPost>> _hydrate(List<Map<String, dynamic>> rows) async {
    if (rows.isEmpty) return const [];
    final ids = [for (final r in rows) r['id'] as String];
    final paths = [
      for (final r in rows)
        if ((r['photo_paths'] as List?)?.isNotEmpty ?? false) (r['photo_paths'] as List).first as String,
    ];
    final likedRows = await _db.from('likes').select('post_id').eq('user_id', _uid).inFilter('post_id', ids);
    final liked = {for (final l in likedRows) l['post_id'] as String};
    final signed = paths.isEmpty ? const <SignedUrlResult>[] : await _db.storage.from(_bucket).createSignedUrlsResult(paths, 3600);
    final urls = {for (final s in signed.whereType<SignedUrlSuccess>()) s.path: s.signedUrl};
    return [
      for (final r in rows)
        FeedPost.fromJson(
          r,
          likedByMe: liked.contains(r['id']),
          photoUrl: (r['photo_paths'] as List?)?.isNotEmpty ?? false ? urls[(r['photo_paths'] as List).first] : null,
        ),
    ];
  }

  @override
  Future<List<NewsArticle>> news({bool onlyMySpecies = false}) async {
    final rows = await _db.rpc<List<dynamic>>('news_feed', params: {'lim': 40, 'only_my_species': onlyMySpecies});
    return rows.cast<Map<String, dynamic>>().map(NewsArticle.fromJson).toList();
  }

  @override
  Future<FeedPost> createPost(NewPost post) async {
    final id = _uuid.v4();
    final paths = <String>[];
    if (post.photoBytes != null) {
      final path = '$_uid/$id/0.jpg';
      await _db.storage.from(_bucket).uploadBinary(path, post.photoBytes!, fileOptions: const FileOptions(contentType: 'image/jpeg'));
      paths.add(path);
    }
    final row = await _db
        .from('posts')
        .insert({
          'id': id,
          'text': post.text,
          'plant_id': post.plantId,
          'photo_paths': paths,
          'visibility': post.visibility.dbName,
          'kind': 'photo',
        })
        .select(_select)
        .single();
    return (await _hydrate([row])).single;
  }

  static const _commentSelect = '*, author:profiles!comments_author_id_fkey(username)';

  @override
  Future<List<PostComment>> comments(String postId) async {
    final rows = await _db
        .from('comments')
        .select(_commentSelect)
        .eq('post_id', postId)
        .isFilter('deleted_at', null)
        .order('created_at')
        .limit(200);
    return [for (final r in rows) PostComment.fromJson(r, myId: _uid)];
  }

  @override
  Future<PostComment> addComment(String postId, String text) async {
    final row = await _db
        .from('comments')
        .insert({'id': _uuid.v4(), 'post_id': postId, 'text': text})
        .select(_commentSelect)
        .single();
    return PostComment.fromJson(row, myId: _uid);
  }

  /// Мягкое удаление: счётчик комментариев поправит триггер.
  @override
  Future<void> deleteComment(String commentId) =>
      _db.from('comments').update({'deleted_at': DateTime.now().toUtc().toIso8601String()}).eq('id', commentId);

  @override
  Future<({int posts, int likesReceived})> myActivity() async {
    final rows = await _db.from('posts').select('like_count').eq('author_id', _uid).isFilter('deleted_at', null);
    return (posts: rows.length, likesReceived: rows.fold<int>(0, (sum, r) => sum + (r['like_count'] as int)));
  }

  @override
  Future<void> setLiked(String postId, bool liked) async {
    if (liked) {
      await _db.from('likes').upsert({'user_id': _uid, 'post_id': postId}, ignoreDuplicates: true);
    } else {
      await _db.from('likes').delete().eq('user_id', _uid).eq('post_id', postId);
    }
  }
}
