export const MOD_DATABASE = {
  version: "3.26",

  modifiers: {

    life: {
      id: "life",

      name: "+# to maximum Life",

      type: "prefix",

      group: "Life",

      tiers: [
        {
          tier: 1,
          requiredItemLevel: 84,
          weight: 25,
          min: 120,
          max: 129
        },

        {
          tier: 2,
          requiredItemLevel: 79,
          weight: 50,
          min: 100,
          max: 119
        },

        {
          tier: 3,
          requiredItemLevel: 73,
          weight: 100,
          min: 80,
          max: 99
        },

        {
          tier: 4,
          requiredItemLevel: 64,
          weight: 250,
          min: 60,
          max: 79
        }
      ]
    },


    fire_resistance: {
      id: "fire_resistance",

      name: "+#% to Fire Resistance",

      type: "suffix",

      group: "FireResistance",

      tiers: [
        {
          tier: 1,
          requiredItemLevel: 84,
          weight: 25,
          min: 46,
          max: 48
        },

        {
          tier: 2,
          requiredItemLevel: 75,
          weight: 50,
          min: 41,
          max: 45
        },

        {
          tier: 3,
          requiredItemLevel: 60,
          weight: 100,
          min: 31,
          max: 40
        },

        {
          tier: 4,
          requiredItemLevel: 40,
          weight: 200,
          min: 21,
          max: 30
        }
      ]
    },


    shaper_spell_damage: {
      id: "shaper_spell_damage",

      name: "#% increased Spell Damage",

      type: "prefix",

      group: "SpellDamage",

      influence: "shaper",

      tiers: [
        {
          tier: 1,
          requiredItemLevel: 85,
          weight: 25,
          min: 80,
          max: 89
        },

        {
          tier: 2,
          requiredItemLevel: 75,
          weight: 50,
          min: 60,
          max: 79
        },

        {
          tier: 3,
          requiredItemLevel: 68,
          weight: 100,
          min: 40,
          max: 59
        }
      ]
    }

  }
};
