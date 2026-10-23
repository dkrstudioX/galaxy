using UnityEngine;
using System.IO;
using System.Collections.Generic;

namespace Galaxy.Hangar.Editor
{
    public class CreateDemoData : EditorWindow
    {
        [MenuItem("Galaxy/Создать демо-данные")]
        public static void ShowWindow()
        {
            GetWindow<CreateDemoData>("Создать демо-данные");
        }

        private void OnGUI()
        {
            GUILayout.Label("Создание демо-данных для Galaxy Hangar", EditorStyles.boldLabel);
            EditorGUILayout.Space();

            if (GUILayout.Button("Создать каталог"))
                CreateDemoCatalog();

            if (GUILayout.Button("Создать категории"))
                CreateDemoCategories();

            EditorGUILayout.Space();
            EditorGUILayout.HelpBox("После создания назначьте ScriptableObjects в DataManager на сцене.", MessageType.Info);
        }

        private void CreateDemoCatalog()
        {
            var catalog = ScriptableObject.CreateInstance<CatalogSO>();
            catalog.name = "DemoCatalog";

            var equipmentCat = AssetDatabase.LoadAssetAtPath<CategorySO>("Assets/Data/Categories/Equipment.asset");
            var resourcesCat = AssetDatabase.LoadAssetAtPath<CategorySO>("Assets/Data/Categories/Resources.asset");
            var shipsCat = AssetDatabase.LoadAssetAtPath<CategorySO>("Assets/Data/Categories/Ships.asset");

            catalog.Items = new CatalogSO.Entry[]
            {
                // Оборудование
                new CatalogSO.Entry { id = "laser_m1", name = "Лазер M-1", category = equipmentCat, priceBuy = 25000, priceSale = 17500, mass = 50, slotId = "weapon" },
                new CatalogSO.Entry { id = "laser_m2", name = "Лазер M-2", category = equipmentCat, priceBuy = 50000, priceSale = 35000, mass = 80, slotId = "weapon" },
                new CatalogSO.Entry { id = "cannon_p1", name = "Пулемёт P-1", category = equipmentCat, priceBuy = 30000, priceSale = 21000, mass = 60, slotId = "weapon" },
                new CatalogSO.Entry { id = "shield_s1", name = "Щит S-1", category = equipmentCat, priceBuy = 30000, priceSale = 21000, mass = 100, slotId = "shield" },
                new CatalogSO.Entry { id = "shield_s2", name = "Щит S-2", category = equipmentCat, priceBuy = 55000, priceSale = 38500, mass = 150, slotId = "shield" },
                new CatalogSO.Entry { id = "engine_e1", name = "Двигатель E-1", category = equipmentCat, priceBuy = 40000, priceSale = 28000, mass = 200, slotId = "engine" },
                new CatalogSO.Entry { id = "engine_e2", name = "Двигатель E-2", category = equipmentCat, priceBuy = 70000, priceSale = 49000, mass = 300, slotId = "engine" },
                new CatalogSO.Entry { id = "container_500", name = "Грузовой отсек 500кг", category = equipmentCat, priceBuy = 15000, priceSale = 10000, mass = 100, capacity = 500, prop2 = new string[] { "stone" } },
                new CatalogSO.Entry { id = "container_2t", name = "Грузовой отсек 2т", category = equipmentCat, priceBuy = 40000, priceSale = 28000, mass = 250, capacity = 2000, prop2 = new string[] { "iron", "copper" } },
                new CatalogSO.Entry { id = "container_5t", name = "Грузовой отсек 5т", category = equipmentCat, priceBuy = 80000, priceSale = 56000, mass = 500, capacity = 5000, prop2 = new string[] { "copper", "gold" } },
                new CatalogSO.Entry { id = "container_10t", name = "Грузовой отсек 10т", category = equipmentCat, priceBuy = 150000, priceSale = 105000, mass = 800, capacity = 10000, prop2 = new string[] { "iron", "copper", "gold", "stone" } },

                // Ресурсы
                new CatalogSO.Entry { id = "iron", name = "Железо", category = resourcesCat, priceBuy = 6, priceSale = 4, mass = 1 },
                new CatalogSO.Entry { id = "copper", name = "Медь", category = resourcesCat, priceBuy = 9, priceSale = 6, mass = 1 },
                new CatalogSO.Entry { id = "gold", name = "Золото", category = resourcesCat, priceBuy = 25, priceSale = 18, mass = 1 },
                new CatalogSO.Entry { id = "stone", name = "Камень", category = resourcesCat, priceBuy = 3, priceSale = 2, mass = 1 },

                // Корабли
                new CatalogSO.Entry { id = "freighter", name = "Freighter X1", category = shipsCat, priceBuy = 500000, priceSale = 350000, mass = 1000, isShip = true },
                new CatalogSO.Entry { id = "shuttle", name = "Шаттл", category = shipsCat, priceBuy = 200000, priceSale = 140000, mass = 500, isShip = true },
                new CatalogSO.Entry { id = "corvette", name = "Корвет", category = shipsCat, priceBuy = 350000, priceSale = 245000, mass = 750, isShip = true },
                new CatalogSO.Entry { id = "frigate", name = "Фрегат", category = shipsCat, priceBuy = 800000, priceSale = 560000, mass = 2000, isShip = true },
                new CatalogSO.Entry { id = "battleship", name = "Линкор", category = shipsCat, priceBuy = 2000000, priceSale = 1400000, mass = 5000, isShip = true }
            };

            AssetDatabase.CreateAsset(catalog, "Assets/Data/Catalogs/DemoCatalog.asset");
            AssetDatabase.SaveAssets();

            Debug.Log("[CreateDemoData] Каталог создан: DemoCatalog");
        }

        private void CreateDemoCategories()
        {
            // Оборудование
            var equipment = AssetDatabase.LoadAssetAtPath<CategorySO>("Assets/Data/Categories/Equipment.asset");
            if (equipment == null)
            {
                equipment = ScriptableObject.CreateInstance<CategorySO>();
                equipment.name = "Оборудование";
                equipment.type = CategorySO.CategoryType.Equipment;
                AssetDatabase.CreateAsset(equipment, "Assets/Data/Categories/Equipment.asset");
            }

            // Ресурсы
            var resources = AssetDatabase.LoadAssetAtPath<CategorySO>("Assets/Data/Categories/Resources.asset");
            if (resources == null)
            {
                resources = ScriptableObject.CreateInstance<CategorySO>();
                resources.name = "Ресурсы";
                resources.type = CategorySO.CategoryType.Resources;
                AssetDatabase.CreateAsset(resources, "Assets/Data/Categories/Resources.asset");
            }

            // Корабли
            var ships = AssetDatabase.LoadAssetAtPath<CategorySO>("Assets/Data/Categories/Ships.asset");
            if (ships == null)
            {
                ships = ScriptableObject.CreateInstance<CategorySO>();
                ships.name = "Корабли";
                ships.type = CategorySO.CategoryType.Ships;
                AssetDatabase.CreateAsset(ships, "Assets/Data/Categories/Ships.asset");
            }

            AssetDatabase.SaveAssets();
            Debug.Log("[CreateDemoData] Категории созданы");
        }
    }
}
