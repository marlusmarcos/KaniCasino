const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/authMiddleware");

const User = require("../models/User");
const Case = require("../models/Case");

// Rarities array
const Rarities = [
  { id: "1", chance: 0.7992 },
  { id: "2", chance: 0.1598 },
  { id: "3", chance: 0.032 },
  { id: "4", chance: 0.0064 },
  { id: "5", chance: 0.0026 },
];

// Helper functions
function groupItemsByRarity(items) {
  const itemsByRarity = {};
  items.forEach((item) => {
    if (!itemsByRarity[item.rarity]) {
      itemsByRarity[item.rarity] = [];
    }
    itemsByRarity[item.rarity].push(item);
  });
  return itemsByRarity;
}

function getRandomWeightedItem(items, weightPropertyName) {
  const randomNumber = Math.random();
  let cumulativeWeight = 0;
  for (const item of items) {
    cumulativeWeight += item[weightPropertyName];
    if (randomNumber <= cumulativeWeight) {
      return item;
    }
  }
}

function getRandomItemFromRarity(itemsByRarity, rarity) {
  const items = itemsByRarity[rarity];
  if (!items || items.length === 0) {
    return null;
  }
  return items[Math.floor(Math.random() * items.length)];
}

// Routes
router.post("/openCase/:id", isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const caseData = await Case.findById(id).populate("items");
    const user = await User.findById(userId);

    if (!caseData || !user) {
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      } else {
        return res.status(404).json({ message: "User not found" });
      }
    }

    if (user.walletBalance < caseData.price) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    user.walletBalance -= caseData.price;
    await user.save();

    const itemsByRarity = groupItemsByRarity(caseData.items);
    const winningRarity = getRandomWeightedItem(Rarities, "chance");
    const winningItem = getRandomItemFromRarity(
      itemsByRarity,
      winningRarity.id
    );

    // Add the entire winning item object to the user's inventory
    user.inventory.unshift(winningItem);

    //update user xp by +10*case price
    user.xp += 10 * caseData.price;

    //update user level
    if (user.xp >= (user.level + 1) * 1000) {
      user.level += 1;
    }

    await user.save();

    res.json({ item: winningItem });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
