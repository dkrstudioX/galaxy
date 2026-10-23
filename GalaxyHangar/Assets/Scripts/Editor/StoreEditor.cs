using UnityEngine;
using UnityEditor;
using System.Collections.Generic;
using System.Linq;
using Galaxy.Hangar.Data;

namespace Galaxy.Hangar.Editor
{
    public class StoreEditor : EditorWindow
    {
        private Vector2 scrollPos;
        private int selectedTab = 0;
        private string[] tabs = { "Категории", "Объекты", "Корабли", "Данные" };

        [MenuItem("Galaxy/Админ-панель")]
        public static void ShowWindow()
        {
            GetWindow<StoreEditor>("Админ-панель");
        }

        private void OnGUI()
        {
            GUILayout.Label("Galaxy Hangar — Админ-панель", EditorStyles.boldLabel);

            EditorGUILayout.Space();

            // Sidebar tabs
            EditorGUILayout.BeginHorizontal();
            EditorGUILayout.BeginVertical(GUILayout.Width(150));
            for (int i = 0; i < tabs.Length; i++)
            {
                if (GUILayout.Button(tabs[i], selectedTab == i ? EditorStyles.miniButtonLeft : EditorStyles.miniButtonMid))
                    selectedTab = i;
            }
            EditorGUILayout.EndVertical();

            // Content
            EditorGUILayout.BeginVertical();
            scrollPos = EditorGUILayout.BeginScrollView(scrollPos);

            switch (selectedTab)
            {
                case 0: DrawCategoriesTab(); break;
                case 1: DrawObjectsTab(); break;
                case 2: DrawShipsTab(); break;
                case 3: DrawDataTab(); break;
            }

            EditorGUILayout.EndScrollView();
            EditorGUILayout.EndVertical();
            EditorGUILayout.EndHorizontal();

            Repaint();
        }

        private void DrawCategoriesTab()
        {
            var categories = AssetDatabase.FindAssets("t:CategorySO")
                .Select(AssetDatabase.GUIDToAssetPath)
                .Select(AssetDatabase.LoadAssetAtPath<CategorySO>)
                .Where(c => c != null)
                .ToList();

            EditorGUILayout.LabelField("Категории (" + categories.Count + ")", EditorStyles.boldLabel);

            foreach (var cat in categories)
            {
                EditorGUILayout.BeginHorizontal();
                EditorGUI.indentLevel++;
                cat.name = EditorGUILayout.TextField(cat.name, GUILayout.Width(200));
                cat.type = (CategorySO.CategoryType)EditorGUILayout.EnumPopup(cat.type, GUILayout.Width(100));
                if (GUILayout.Button("Сохранить", GUILayout.Width(70)))
                {
                    EditorUtility.SetDirty(cat);
                    AssetDatabase.SaveAssets();
                }
                if (GUILayout.Button("Удалить", GUILayout.Width(70)))
                {
                    AssetDatabase.DeleteAsset(AssetDatabase.GetAssetPath(cat));
                    AssetDatabase.SaveAssets();
                }
                EditorGUI.indentLevel--;
                EditorGUILayout.EndHorizontal();
            }
        }

        private void DrawObjectsTab()
        {
            var catalogs = AssetDatabase.FindAssets("t:CatalogSO")
                .Select(AssetDatabase.GUIDToAssetPath)
                .Select(AssetDatabase.LoadAssetAtPath<CatalogSO>)
                .Where(c => c != null)
                .ToList();

            if (catalogs.Count == 0)
            {
                EditorGUILayout.HelpBox("Нет каталогов. Создайте через контекстное меню.", MessageType.Info);
                if (GUILayout.Button("Создать каталог"))
                {
                    var cat = ScriptableObject.CreateInstance<CatalogSO>();
                    AssetDatabase.CreateAsset(cat, "Assets/Data/Catalogs/NewCatalog.asset");
                    AssetDatabase.SaveAssets();
                }
                return;
            }

            var catalog = catalogs[0];
            EditorGUILayout.LabelField("Объекты каталога (" + catalog.Items.Length + ")", EditorStyles.boldLabel);

            for (int i = 0; i < catalog.Items.Length; i++)
            {
                var item = catalog.Items[i];
                if (item == null) continue;

                EditorGUILayout.BeginHorizontal();
                EditorGUI.indentLevel++;

                item.name = EditorGUILayout.TextField(item.name, GUILayout.Width(150));
                item.priceBuy = EditorGUILayout.IntField(item.priceBuy, GUILayout.Width(80));
                item.priceSale = EditorGUILayout.IntField(item.priceSale, GUILayout.Width(80));
                item.mass = EditorGUILayout.IntField(item.mass, GUILayout.Width(60));

                if (GUILayout.Button("Сохранить", GUILayout.Width(70)))
                {
                    EditorUtility.SetDirty(catalog);
                    AssetDatabase.SaveAssets();
                }
                if (GUILayout.Button("Удалить", GUILayout.Width(70)))
                {
                    var newItems = catalog.Items.Where((_, idx) => idx != i).ToArray();
                    catalog.Items = newItems;
                    EditorUtility.SetDirty(catalog);
                    AssetDatabase.SaveAssets();
                }

                EditorGUI.indentLevel--;
                EditorGUILayout.EndHorizontal();
            }
        }

        private void DrawShipsTab()
        {
            EditorGUILayout.LabelField("Редактор кораблей", EditorStyles.boldLabel);
            EditorGUILayout.HelpBox("Редактируйте корабли через каталог (вкладка 'Объекты').", MessageType.Info);
        }

        private void DrawDataTab()
        {
            EditorGUILayout.LabelField("Управление данными", EditorStyles.boldLabel);

            if (GUILayout.Button("Экспорт данных (JSON)"))
            {
                ExportData();
            }

            if (GUILayout.Button("Импорт данных (JSON)"))
            {
                ImportData();
            }

            if (GUILayout.Button("Загрузить демо-данные"))
            {
                LoadDemoData();
            }

            EditorGUILayout.Space();
            EditorGUILayout.LabelField("Статистика", EditorStyles.boldLabel);
            var catalogs = AssetDatabase.FindAssets("t:CatalogSO").Length;
            var categories = AssetDatabase.FindAssets("t:CategorySO").Length;
            EditorGUILayout.LabelField("Каталогов: " + catalogs);
            EditorGUILayout.LabelField("Категорий: " + categories);
        }

        private void ExportData()
        {
            var path = EditorUtility.SaveFilePanel("Экспорт данных", "", "galaxy_backup.json", "json");
            if (string.IsNullOrEmpty(path)) return;

            var catalogs = AssetDatabase.FindAssets("t:CatalogSO")
                .Select(AssetDatabase.GUIDToAssetPath)
                .Select(AssetDatabase.LoadAssetAtPath<CatalogSO>)
                .Where(c => c != null)
                .ToList();

            var categories = AssetDatabase.FindAssets("t:CategorySO")
                .Select(AssetDatabase.GUIDToAssetPath)
                .Select(AssetDatabase.LoadAssetAtPath<CategorySO>)
                .Where(c => c != null)
                .ToList();

            var data = new ExportData { catalogs = catalogs, categories = categories };
            var json = JsonUtility.ToJson(data, true);
            System.IO.File.WriteAllText(path, json);
            EditorUtility.DisplayDialog("Экспорт", "Данные экспортированы в:\n" + path, "OK");
        }

        private void ImportData()
        {
            var path = EditorUtility.OpenFilePanel("Импорт данных", "", "json");
            if (string.IsNullOrEmpty(path)) return;

            var json = System.IO.File.ReadAllText(path);
            var data = JsonUtility.FromJson<ExportData>(json);

            if (data.catalogs != null)
            {
                foreach (var cat in data.catalogs)
                {
                    if (cat != null)
                    {
                        EditorUtility.SetDirty(cat);
                        AssetDatabase.SaveAssets();
                    }
                }
            }

            if (data.categories != null)
            {
                foreach (var cat in data.categories)
                {
                    if (cat != null)
                    {
                        EditorUtility.SetDirty(cat);
                        AssetDatabase.SaveAssets();
                    }
                }
            }

            EditorUtility.DisplayDialog("Импорт", "Данные импортированы", "OK");
        }

        private void LoadDemoData()
        {
            if (EditorUtility.DisplayDialog("Демо-данные", "Это создаст тестовые данные. Продолжить?", "Да", "Нет"))
            {
                CreateDemoCatalog();
                CreateDemoCategories();
                EditorUtility.DisplayDialog("Готово", "Демо-данные созданы", "OK");
            }
        }

        private void CreateDemoCatalog()
        {
            var catalog = ScriptableObject.CreateInstance<CatalogSO>();
            catalog.name = "DemoCatalog";
            catalog.Items = new CatalogSO.Entry[]
            {
                new CatalogSO.Entry { id = "laser_m1", name = "Лазер M-1", priceBuy = 25000, priceSale = 17500, mass = 50, slotId = "weapon" },
                new CatalogSO.Entry { id = "shield_s1", name = "Щит S-1", priceBuy = 30000, priceSale = 21000, mass = 100, slotId = "shield" },
                new CatalogSO.Entry { id = "engine_e1", name = "Двигатель E-1", priceBuy = 40000, priceSale = 28000, mass = 200, slotId = "engine" },
                new CatalogSO.Entry { id = "iron", name = "Железо", priceBuy = 6, priceSale = 4, mass = 1 },
                new CatalogSO.Entry { id = "copper", name = "Медь", priceBuy = 9, priceSale = 6, mass = 1 },
                new CatalogSO.Entry { id = "gold", name = "Золото", priceBuy = 25, priceSale = 18, mass = 1 },
                new CatalogSO.Entry { id = "stone", name = "Камень", priceBuy = 3, priceSale = 2, mass = 1 },
                new CatalogSO.Entry { id = "freighter", name = "Freighter X1", priceBuy = 500000, priceSale = 350000, mass = 1000, isShip = true }
            };
            AssetDatabase.CreateAsset(catalog, "Assets/Data/Catalogs/DemoCatalog.asset");
            AssetDatabase.SaveAssets();
        }

        private void CreateDemoCategories()
        {
            var equipment = ScriptableObject.CreateInstance<CategorySO>();
            equipment.name = "Оборудование";
            equipment.type = CategorySO.CategoryType.Equipment;
            AssetDatabase.CreateAsset(equipment, "Assets/Data/Categories/Equipment.asset");

            var resources = ScriptableObject.CreateInstance<CategorySO>();
            resources.name = "Ресурсы";
            resources.type = CategorySO.CategoryType.Resources;
            AssetDatabase.CreateAsset(resources, "Assets/Data/Categories/Resources.asset");

            var ships = ScriptableObject.CreateInstance<CategorySO>();
            ships.name = "Корабли";
            ships.type = CategorySO.CategoryType.Ships;
            AssetDatabase.CreateAsset(ships, "Assets/Data/Categories/Ships.asset");

            AssetDatabase.SaveAssets();
        }

        [System.Serializable]
        private class ExportData
        {
            public List<CatalogSO> catalogs;
            public List<CategorySO> categories;
        }
    }
}
