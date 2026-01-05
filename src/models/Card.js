// src/models/Card.js

/**
 * Abstract base class for all card types.
 */
class Card {
    /**
     * @param {'Leader' | 'Follower' | 'Legend' | 'Castable' | 'Equipment' | 'Enchantment' | 'Environment'} type
     * @param {string} name
     * @param {string} description
    * @param {Array<string>} affiliation
     * @param {string} cost
     * @param {string} attack
     * @param {string} life
     * @param {string} phyRes
     * @param {string} magRes
     * @param {{
     *  active?: Function,
     *  aura?: boolean,
     *  onPlay?: Function,
     *  onEnter?: Function,
     *  onLeave?: Function,
     *  onTurnStart?: Function,
     *  onTurnEnd?: Function,
     *  onAttack?: Function,
     * 
     * 
     * }} effects
     */
    constructor(type, name, description, affiliation = [], cost = '', attack = '', life = '', phyRes = '', magRes = '', effects = {}) {
        this.type = type;
        this.name = name;
        this.description = description;
        this.affiliation = affiliation;
        this.cost = cost;
        this.attack = attack;
        this.life = life;
        this.phyRes = phyRes;
        this.magRes = magRes;
        this.effects = effects;
    }
}

export default Card;