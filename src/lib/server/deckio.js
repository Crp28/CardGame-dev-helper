// Client-side data layer for decks using the shared Dexie (IndexedDB) instance.
// The 'decks' table was registered in cardio.js version 3.

import { getDb } from './cardio';

const DECK_STORE = 'decks';

const DEFAULT_DECK = {
    name: '',
    cards: [],
    leaders: [],
    sideboard: [],
};

const normalizeDeck = (input = {}) => ({
    name: String(input.name ?? '').trim(),
    cards: Array.isArray(input.cards) ? input.cards : [],
    leaders: Array.isArray(input.leaders) ? input.leaders : [],
    sideboard: Array.isArray(input.sideboard) ? input.sideboard : [],
});

/**
 * Create a new deck.
 * @param {Partial<typeof DEFAULT_DECK>} input
 * @returns {Promise<{id: number} & typeof DEFAULT_DECK>}
 */
export const createDeck = async (input = {}) => {
    const db = getDb();
    const deck = normalizeDeck({ ...DEFAULT_DECK, ...input });
    const id = await db.table(DECK_STORE).add(deck);
    return { id, ...deck };
};

/** Return all stored decks. */
export const getAllDecks = async () => {
    const db = getDb();
    return db.table(DECK_STORE).toArray();
};

export const getDeckById = async (id) => {
    const db = getDb();
    return db.table(DECK_STORE).get(id);
};

/**
 * Partial update for a deck.
 * Only name, cards, leaders, sideboard are accepted.
 */
export const updateDeck = async (id, updates = {}) => {
    const db = getDb();
    const allowed = ['name', 'cards', 'leaders', 'sideboard'];
    const payload = {};
    for (const key of allowed) {
        if (key in updates) {
            payload[key] = updates[key];
        }
    }
    await db.table(DECK_STORE).update(id, payload);
    return db.table(DECK_STORE).get(id);
};

/** Delete a deck by id. */
export const deleteDeck = async (id) => {
    const db = getDb();
    await db.table(DECK_STORE).delete(id);
};
