using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace Galaxy.Hangar.Data
{
    [Serializable]
    public class ShipRecord
    {
        public string id;
        public string shipId;
        public string name;
        public int credits = 3500000;
        public List<SlotEntry> slots = new();
        public List<HoldEntry> holds = new();
    }

    [Serializable]
    public class SlotEntry
    {
        public string slotId;
        public string contentsId;
    }

    [Serializable]
    public class HoldEntry
    {
        public string name;
        public int capacity;
        public List<string> contents = new();
    }

    public static class Store
    {
        private static string SavePath => Path.Combine(Application.persistentDataPath, "galaxy_hangar_save.json");

        public static CatalogSO catalog;
        public static CategorySO[] categories;
        public static List<ShipRecord> userShips = new();
        public static ShipRecord activeShip;

        public static int Credits => activeShip?.credits ?? 3500000;

        public static void Initialize(CatalogSO catalogData, CategorySO[] catData)
        {
            catalog = catalogData;
            categories = catData;
            Load();
            if (userShips.Count == 0)
                LoadDemo();
        }

        public static void Save()
        {
            var data = new SaveData { ships = userShips };
            var json = JsonUtility.ToJson(data, true);
            File.WriteAllText(SavePath, json);
            Debug.Log($"[Store] Saved: {SavePath}");
        }

        public static void Load()
        {
            if (!File.Exists(SavePath)) return;
            var json = File.ReadAllText(SavePath);
            var data = JsonUtility.FromJson<SaveData>(json);
            userShips = data?.ships ?? new List<ShipRecord>();
            Debug.Log($"[Store] Loaded: {userShips.Count} ships");
        }

        public static void LoadDemo()
        {
            userShips.Clear();
            var demo = CreateDemoShip();
            userShips.Add(demo);
            activeShip = demo;
            Save();
            Debug.Log("[Store] Demo data loaded");
        }

        private static ShipRecord CreateDemoShip()
        {
            var record = new ShipRecord
            {
                id = Guid.NewGuid().ToString(),
                shipId = "freighter",
                name = "Freighter X1",
                credits = 3500000,
                slots = new List<SlotEntry>
                {
                    new() { slotId = "weapon", contentsId = null },
                    new() { slotId = "shield", contentsId = null },
                    new() { slotId = "engine", contentsId = null }
                },
                holds = new List<HoldEntry>
                {
                    new() { name = "Hold 1", capacity = 2000, contents = new List<string>() },
                    new() { name = "Hold 2", capacity = 1000, contents = new List<string>() }
                }
            };
            return record;
        }

        [Serializable]
        private class SaveData
        {
            public List<ShipRecord> ships;
        }
    }
}
