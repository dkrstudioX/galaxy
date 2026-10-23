using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Galaxy.Hangar.Data;
using Galaxy.Hangar.State;
using Galaxy.Hangar.Economy;

namespace Galaxy.Hangar.UI
{
    public class ShopPanel : MonoBehaviour
    {
        [Header("Category Tabs")]
        public Button allTab;
        public Button equipmentTab;
        public Button resourcesTab;
        public Button shipsTab;

        [Header("Subcategory Chips")]
        public Transform chipsContainer;
        public GameObject chipPrefab;

        [Header("Items List")]
        public Transform itemsContainer;
        public GameObject itemCardPrefab;

        private void Awake()
        {
            allTab.onClick.AddListener(() => OnCategoryClicked(AppState.Category.All));
            equipmentTab.onClick.AddListener(() => OnCategoryClicked(AppState.Category.Equipment));
            resourcesTab.onClick.AddListener(() => OnCategoryClicked(AppState.Category.Resources));
            shipsTab.onClick.AddListener(() => OnCategoryClicked(AppState.Category.Ships));
        }

        public void Refresh()
        {
            UpdateCategoryTabs();
            UpdateChips();
            UpdateItems();
        }

        private void UpdateCategoryTabs()
        {
            SetTabActive(allTab, AppState.currentCategory == AppState.Category.All);
            SetTabActive(equipmentTab, AppState.currentCategory == AppState.Category.Equipment);
            SetTabActive(resourcesTab, AppState.currentCategory == AppState.Category.Resources);
            SetTabActive(shipsTab, AppState.currentCategory == AppState.Category.Ships);
        }

        private void SetTabActive(Button btn, bool active)
        {
            var color = active ? new Color(0.5f, 0.9f, 1f) : new Color(0.7f, 0.7f, 0.8f);
            btn.image.color = color;
        }

        private void OnCategoryClicked(AppState.Category cat)
        {
            AppState.SetCategory(cat);
            Refresh();
        }

        private void UpdateChips()
        {
            foreach (Transform child in chipsContainer) Destroy(child.gameObject);

            if (AppState.currentCategory == AppState.Category.All) return;

            var rootCat = GetRootCategory();
            if (rootCat == null) return;

            foreach (var child in rootCat.Children)
            {
                if (child == null) continue;
                var chip = Instantiate(chipPrefab, chipsContainer);
                var text = chip.GetComponentInChildren<Text>();
                text.text = child.Name;
                var btn = chip.GetComponent<Button>();
                var catName = child.Name;
                btn.onClick.AddListener(() =>
                {
                    AppState.SetSubcategory(AppState.selectedSubcategory == catName ? null : catName);
                    Refresh();
                });
            }
        }

        private CategorySO GetRootCategory()
        {
            foreach (var cat in Store.categories)
            {
                if (cat != null && (
                    (AppState.currentCategory == AppState.Category.Equipment && cat.IsEquipmentRoot) ||
                    (AppState.currentCategory == AppState.Category.Resources && cat.IsResourceRoot) ||
                    (AppState.currentCategory == AppState.Category.Ships && cat.IsShipRoot)))
                    return cat;
            }
            return null;
        }

        private void UpdateItems()
        {
            foreach (Transform child in itemsContainer) Destroy(child.gameObject);

            foreach (var entry in Store.catalog.Items)
            {
                if (entry == null) continue;
                if (!MatchesCategory(entry)) continue;
                if (!MatchesSubcategory(entry)) continue;

                var card = Instantiate(itemCardPrefab, itemsContainer);
                card.GetComponent<ItemCard>().Setup(entry);
            }
        }

        private bool MatchesCategory(CatalogSO.Entry entry)
        {
            if (AppState.currentCategory == AppState.Category.All) return true;
            if (AppState.currentCategory == AppState.Category.Equipment)
                return entry.category != null && entry.category.IsEquipmentRoot;
            if (AppState.currentCategory == AppState.Category.Resources)
                return entry.category != null && entry.category.IsResourceRoot;
            if (AppState.currentCategory == AppState.Category.Ships)
                return entry.category != null && entry.category.IsShipRoot;
            return false;
        }

        private bool MatchesSubcategory(CatalogSO.Entry entry)
        {
            if (string.IsNullOrEmpty(AppState.selectedSubcategory)) return true;
            return entry.category != null && entry.category.Name == AppState.selectedSubcategory;
        }
    }
}
