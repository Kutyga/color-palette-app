import 'dart:typed_data';

import '../../collection/domain/plant.dart';

enum FeedTab { following, discover }

class FeedPost {
  const FeedPost({
    required this.id,
    required this.authorId,
    required this.authorName,
    required this.text,
    required this.createdAt,
    this.plantId,
    this.plantName,
    this.photoUrl,
    this.photoBytes,
    this.likeCount = 0,
    this.commentCount = 0,
    this.likedByMe = false,
  });

  final String id;
  final String authorId;
  final String authorName;
  final String text;
  final DateTime createdAt;
  final String? plantId;
  final String? plantName;

  /// Подписанная ссылка на фото в Storage.
  final String? photoUrl;

  /// Фото, ещё не загруженное на сервер (демо-режим).
  final Uint8List? photoBytes;
  final int likeCount;
  final int commentCount;
  final bool likedByMe;

  FeedPost copyWith({bool? likedByMe, int? likeCount}) => FeedPost(
        id: id,
        authorId: authorId,
        authorName: authorName,
        text: text,
        createdAt: createdAt,
        plantId: plantId,
        plantName: plantName,
        photoUrl: photoUrl,
        photoBytes: photoBytes,
        likeCount: likeCount ?? this.likeCount,
        commentCount: commentCount,
        likedByMe: likedByMe ?? this.likedByMe,
      );

  /// Ожидает выборку `*, author:profiles(username, display_name), plant:plants(nickname)`.
  factory FeedPost.fromJson(Map<String, dynamic> json, {String? photoUrl, bool likedByMe = false}) {
    final author = json['author'] as Map<String, dynamic>?;
    final plant = json['plant'] as Map<String, dynamic>?;
    return FeedPost(
      id: json['id'] as String,
      authorId: json['author_id'] as String,
      authorName: (author?['username'] as String?) ?? 'садовник',
      text: json['text'] as String? ?? '',
      createdAt: DateTime.parse(json['created_at'] as String).toLocal(),
      plantId: json['plant_id'] as String?,
      plantName: plant?['nickname'] as String?,
      photoUrl: photoUrl,
      likeCount: json['like_count'] as int? ?? 0,
      commentCount: json['comment_count'] as int? ?? 0,
      likedByMe: likedByMe,
    );
  }
}

class NewPost {
  const NewPost({required this.text, this.plantId, this.photoBytes, this.visibility = PlantVisibility.public});

  final String text;
  final String? plantId;
  final Uint8List? photoBytes;

  /// Для постов доступны только «Подписчики» и «Все».
  final PlantVisibility visibility;
}

class NewsArticle {
  const NewsArticle({
    required this.id,
    required this.url,
    required this.title,
    required this.sourceName,
    required this.publishedAt,
    this.summary,
    this.imageUrl,
    this.speciesIds = const [],
  });

  final String id;
  final String url;
  final String title;
  final String sourceName;
  final DateTime publishedAt;
  final String? summary;
  final String? imageUrl;
  final List<String> speciesIds;

  factory NewsArticle.fromJson(Map<String, dynamic> json) => NewsArticle(
        id: json['id'] as String,
        url: json['url'] as String,
        title: json['title'] as String,
        sourceName: json['source_name'] as String,
        publishedAt: DateTime.parse(json['published_at'] as String).toLocal(),
        summary: json['summary'] as String?,
        imageUrl: json['image_url'] as String?,
        speciesIds: (json['species_ids'] as List?)?.cast<String>() ?? const [],
      );
}
