import crypto from "node:crypto";

/**
 * This application's User type
 * @typedef {Object} User
 * @property {string} userId - the internal user ID
 * @property {string} phoneNumber - the user's phone number
 * @property {string?} email - the user's email
 */

/**
 * Create a new {@link User} from a phone number
 * @param {string} phoneNumber - the phone number in E.164 format
 * @returns {User} a new user with the given phone number
 */
export function userFromPhoneNumber(phoneNumber) {
  return {
    userId: crypto.randomUUID(),
    phoneNumber,
  };
}

/**
 * In-memory {@link User} database.
 *
 * Allows you to lookup users by ID and by phone number
 */
export class UserDb {
  #users;
  #phoneIndex;

  constructor() {
    this.#users = {};
    this.#phoneIndex = {};
  }

  save(user) {
    if (!user) {
      throw Error("cannot save a null user");
    }

    const { userId } = user;

    this.#users[userId] = user;
    this.#updateIndex(user);
  }

  remove(user) {
    if (!user) {
      throw Error("cannot remove a null user");
    }

    const { userId } = user;

    delete this.#users[userId];
    this.#clearIndex(user);
  }

  findById(userId) {
    if (!userId) {
      return null;
    }
    return this.#users[userId] ?? null;
  }

  findByPhoneNumber(phoneNumber) {
    const userId = this.#phoneIndex[phoneNumber] ?? null;
    return this.findById(userId);
  }

  #updateIndex(user) {
    const { userId, phoneNumber } = user;
    this.#phoneIndex[phoneNumber] = userId;
  }

  #clearIndex(user) {
    const { phoneNumber } = user;
    delete this.#phoneIndex[phoneNumber];
  }
}
