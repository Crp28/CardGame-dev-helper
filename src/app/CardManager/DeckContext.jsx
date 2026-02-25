
'use client'

import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { getAllDecks } from '@/lib/server/deckio';

const DeckContext = createContext(null);

const deckReducer = (state, action) => {
    switch (action.type) {
        case 'ADD_DECK':
            return [...state, action.payload];
        case 'UPDATE_DECK': {
            const { id, updates } = action.payload;
            return state.map(deck => deck.id === id ? { ...deck, ...updates } : deck);
        }
        case 'DELETE_DECK':
            return state.filter(deck => deck.id !== action.payload);
        case 'RESET':
            return Array.isArray(action.payload) ? action.payload : [];
        default:
            return state;
    }
};

export const DeckProvider = ({ children }) => {
    const [state, dispatch] = useReducer(deckReducer, []);

    const value = useMemo(() => ({ decks: state, dispatch }), [state]);

    // Hydrate from IndexedDB on first client render
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const stored = await getAllDecks();
                if (mounted && Array.isArray(stored)) {
                    dispatch(deckActions.reset(stored));
                }
            } catch (error) {
                console.error('Failed to hydrate decks from IndexedDB', error);
            }
        })();
        return () => { mounted = false; };
    }, []);

    return (
        <DeckContext.Provider value={value}>
            {children}
        </DeckContext.Provider>
    );
};

export const useDecks = () => {
    const ctx = useContext(DeckContext);
    if (!ctx) throw new Error('useDecks must be used within a DeckProvider');
    return ctx;
};

export const deckActions = {
    addDeck: (deck) => ({ type: 'ADD_DECK', payload: deck }),
    updateDeck: (id, updates) => ({ type: 'UPDATE_DECK', payload: { id, updates } }),
    deleteDeck: (id) => ({ type: 'DELETE_DECK', payload: id }),
    reset: (payload) => ({ type: 'RESET', payload }),
};

export default DeckContext;
