using System;
using UnityEngine;

namespace Galaxy.Hangar.Data
{
    [CreateAssetMenu(fileName = "NewCategory", menuName = "Galaxy/Category")]
    public class CategorySO : ScriptableObject
    {
        [SerializeField] private string id;
        [SerializeField] private string name;
        [SerializeField] private CategoryType type;
        [SerializeField] private CategorySO parent;
        [SerializeField] private Sprite icon;
        [SerializeField] private int order;
        [SerializeField] private CategorySO[] children;

        public string Id => id;
        public string Name => name;
        public CategoryType Type => type;
        public CategorySO Parent => parent;
        public Sprite Icon => icon;
        public int Order => order;
        public CategorySO[] Children => children;
        public bool IsRoot => parent == null;
        public bool IsShipRoot => type == CategoryType.Ships;
        public bool IsEquipmentRoot => type == CategoryType.Equipment;
        public bool IsResourceRoot => type == CategoryType.Resources;

        public enum CategoryType
        {
            Equipment,
            Resources,
            Ships
        }
    }
}
