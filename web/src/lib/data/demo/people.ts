/**
 * Садоводы в браузере: демо-садоводы и свой профиль.
 */
import {
  PEOPLE_PAGE,
  validateProfile,
  type PeopleSort,
  type PersonCard,
  type PlantProfile,
  type ProfileUpdate,
  type PublicPlant,
} from "../../domain/people";
import type { PeopleRepository, Profile } from "../repositories";
import { DEFAULT_PROFILE, DEMO_PEOPLE, demoId } from "./fixtures";
import { type DemoState, ME } from "./state";

export class DemoPeople implements PeopleRepository {
  constructor(
    private state: DemoState,
    private persist: () => void,
  ) {}

  private get me() {
    return this.state.profile ?? DEFAULT_PROFILE;
  }

  private isFollowing(id: string) {
    return (this.state.following ?? []).includes(id);
  }

  private myCard(): PersonCard {
    return {
      id: ME,
      username: this.me.username,
      displayName: this.me.displayName ?? this.me.username,
      bio: this.me.bio,
      followers: DEMO_PEOPLE.filter((d) => d.followsMe).length,
      following: (this.state.following ?? []).length,
      plants: this.state.plants.length,
      isFollowing: false,
      followsMe: false,
      isMe: true,
    };
  }

  private card(d: (typeof DEMO_PEOPLE)[number]): PersonCard {
    const id = demoId(d.username);
    return {
      id,
      username: d.username,
      displayName: d.displayName,
      bio: d.bio,
      followers: d.followers + (this.isFollowing(id) ? 1 : 0),
      following: DEMO_PEOPLE.length - 1 + (d.followsMe ? 1 : 0),
      plants: d.plants.length,
      isFollowing: this.isFollowing(id),
      followsMe: d.followsMe,
      isMe: false,
    };
  }

  private all() {
    return [this.myCard(), ...DEMO_PEOPLE.map((d) => this.card(d))];
  }

  async search(query: string, sort: PeopleSort = "popular", offset = 0) {
    const q = query.trim().toLowerCase().replace(/^@/, "");
    // У демо-садоводов нет даты регистрации: «новые» — последние в списке.
    const found = q
      ? this.all().filter((p) => p.username.toLowerCase().includes(q) || p.displayName.toLowerCase().includes(q))
      : sort === "new"
        ? DEMO_PEOPLE.map((d) => this.card(d)).reverse()
        : DEMO_PEOPLE.map((d) => this.card(d)).sort((a, b) => b.followers - a.followers);
    return found.slice(offset, offset + PEOPLE_PAGE);
  }

  async byUsername(username: string) {
    return this.all().find((p) => p.username === username) ?? null;
  }

  async followers(userId: string) {
    if (userId === ME) return DEMO_PEOPLE.filter((d) => d.followsMe).map((d) => this.card(d));
    const others = DEMO_PEOPLE.filter((d) => demoId(d.username) !== userId).map((d) => this.card(d));
    return this.isFollowing(userId) ? [this.myCard(), ...others] : others;
  }

  async following(userId: string) {
    if (userId === ME) return DEMO_PEOPLE.filter((d) => this.isFollowing(demoId(d.username))).map((d) => this.card(d));
    const person = DEMO_PEOPLE.find((d) => demoId(d.username) === userId);
    const others = DEMO_PEOPLE.filter((d) => demoId(d.username) !== userId).map((d) => this.card(d));
    return person?.followsMe ? [this.myCard(), ...others] : others;
  }

  async plantsOf(userId: string): Promise<PublicPlant[]> {
    if (userId === ME)
      return this.state.plants.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        speciesSlug: p.speciesSlug,
        photoUrl: this.state.photos[p.id] ?? null,
      }));
    const person = DEMO_PEOPLE.find((d) => demoId(d.username) === userId);
    // id как у записей дневников в демо-ленте — с карточки открывается дневник растения.
    return (person?.plants ?? []).map(([nickname, slug]) => ({
      id: demoId(`${person!.username}/${nickname}`),
      nickname,
      speciesSlug: slug,
      photoUrl: null,
    }));
  }

  async plant(plantId: string): Promise<PlantProfile | null> {
    const me = this.state.profile ?? DEFAULT_PROFILE;
    const own = this.state.plants.find((p) => p.id === plantId);
    if (own)
      return {
        id: own.id,
        nickname: own.nickname,
        speciesSlug: own.speciesSlug,
        photoUrl: this.state.photos[own.id] ?? null,
        notes: own.notes ?? null,
        since: new Date(own.createdAt),
        ownerName: me.username,
        ownerDisplayName: me.displayName ?? me.username,
        mine: true,
      };
    for (const d of DEMO_PEOPLE) {
      const found = d.plants.find(([nickname]) => demoId(`${d.username}/${nickname}`) === plantId);
      if (found)
        return {
          id: plantId,
          nickname: found[0],
          speciesSlug: found[1],
          photoUrl: null,
          notes: null,
          since: new Date(),
          ownerName: d.username,
          ownerDisplayName: d.displayName,
          mine: false,
        };
    }
    return null;
  }

  async updateProfile(update: ProfileUpdate): Promise<Profile> {
    const invalid = validateProfile(update);
    if (invalid) throw new Error(invalid.message);
    if (DEMO_PEOPLE.some((d) => d.username === update.username)) throw new Error(`Имя @${update.username} уже занято — выберите другое`);
    const prev = this.state.profile ?? DEFAULT_PROFILE;
    this.state.profile = {
      username: update.username,
      displayName: update.displayName.trim(),
      bio: update.bio.trim() || null,
      city: update.city !== undefined ? update.city.trim() || null : (prev.city ?? null),
      isAdmin: prev.isAdmin ?? false,
    };
    this.persist();
    return this.state.profile!;
  }
}
