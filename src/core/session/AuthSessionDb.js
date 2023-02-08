export class AuthSessionDb {
  #sessions;
  #checkIndex;
  #linkCodeIndex;

  constructor() {
    this.#sessions = {};
    this.#checkIndex = {};
    this.#linkCodeIndex = {};
  }

  save(authSession) {
    const { sessionId } = authSession;

    this.#sessions[sessionId] = authSession;
    this.#updateIndex(authSession);
  }

  remove(authSession) {
    const { sessionId } = authSession;

    delete this.#sessions[sessionId];
    this.#clearIndex(authSession);
  }

  findBySessionId(sessionId) {
    if (!sessionId) {
      return null;
    }

    return this.#sessions[sessionId] ?? null;
  }

  findByCheckId(checkId) {
    const sessionId = this.#checkIndex[checkId] ?? null;
    return this.findBySessionId(sessionId);
  }

  findByLinkCode(linkCode) {
    const sessionId = this.#linkCodeIndex[linkCode] ?? null;
    return this.findBySessionId(sessionId);
  }

  #updateIndex(authSession) {
    const { sessionId, checkId, linkCode } = authSession;

    if (checkId) {
      this.#checkIndex[checkId] = sessionId;
    }

    if (linkCode) {
      this.#linkCodeIndex[linkCode] = sessionId;
    }
  }

  #clearIndex(verification) {
    const { checkId, linkCode } = verification;
    if (checkId) {
      delete this.#checkIndex[checkId];
    }

    if (linkCode) {
      delete this.#linkCodeIndex[linkCode];
    }
  }
}
