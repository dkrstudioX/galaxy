using System;
using UnityEngine;

namespace Galaxy.Hangar.Data
{
    [CreateAssetMenu(fileName = "NewCatalog", menuName = "Galaxy/Catalog")]
    public class CatalogSO : ScriptableObject
    {
        [Serializable]
        public class Entry
        {
            public string id;
            public string name;
            public CategorySO category;
            public int priceBuy;
            public int priceSale;
            public int mass;
            public Sprite icon;
            public string slotId;
            public string[] prop2;
            public int capacity;
            public bool isShip;
        }

        [SerializeField] private Entry[] items = Array.Empty<Entry>();
        public Entry[] Items => items;
        public Entry GetById(string id) => Array.Find(items, e => e.id == id);
    }
}
