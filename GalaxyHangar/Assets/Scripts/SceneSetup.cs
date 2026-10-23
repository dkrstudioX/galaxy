using UnityEngine;
using UnityEngine.UI;
using Galaxy.Hangar.Data;
using Galaxy.Hangar.Economy;

namespace Galaxy.Hangar.UI
{
    public class SceneSetup : MonoBehaviour
    {
        public CatalogSO catalogSO;
        public CategorySO[] categorySOs;

        [Header("UI References")]
        public Transform itemsContainer;
        public Transform chipsContainer;
        public Transform slotsContainer;
        public Transform holdsContainer;
        public Transform shipsContainer;

        [Header("Texts")]
        public Text creditsText;
        public Text massText;
        public Text shipNameText;

        [Header("Buttons")]
        public Button allTabBtn;
        public Button equipmentTabBtn;
        public Button resourcesTabBtn;
        public Button shipsTabBtn;

        [Header("Prefabs")]
        public GameObject itemCardPrefab;
        public GameObject slotTilePrefab;
        public GameObject holdTilePrefab;
        public GameObject shipCardPrefab;
        public GameObject chipPrefab;

        private void Awake()
        {
            Store.Initialize(catalogSO, categorySOs);
        }

        private void Start()
        {
            SetupTabs();
            RefreshAll();
        }

        private void SetupTabs()
        {
            allTabBtn.onClick.AddListener(() =>
            {
                AppState.SetCategory(AppState.Category.All);
                RefreshAll();
            });
            equipmentTabBtn.onClick.AddListener(() =>
            {
                AppState.SetCategory(AppState.Category.Equipment);
                RefreshAll();
            });
            resourcesTabBtn.onClick.AddListener(() =>
            {
                AppState.SetCategory(AppState.Category.Resources);
                RefreshAll();
            });
            shipsTabBtn.onClick.AddListener(() =>
            {
                AppState.SetCategory(AppState.Category.Ships);
                RefreshAll();
            });
        }

        private void RefreshAll()
        {
            if (creditsText != null)
                creditsText.text = Store.Credits.ToString("N0");
            if (massText != null)
                massText.text = MassService.GetShipMass().ToString("N0") + " \u043a\u0433";
            if (shipNameText != null)
                shipNameText.text = Store.activeShip?.name ?? "\u041d\u0435\u0442 \u043a\u043e\u0440\u0430\u0431\u043b\u044f";

            RefreshChips();
            RefreshItems();
            RefreshSlots();
            RefreshHolds();
            RefreshShips();
        }

        private void RefreshChips()
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
                    RefreshAll();
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

        private void RefreshItems()
        {
            foreach (Transform child in itemsContainer) Destroy(child.gameObject);

            foreach (var entry in Store.catalog.Items)
            {
                if (entry == null) continue;
                if (!MatchesCategory(entry)) continue;
                if (!MatchesSubcategory(entry)) continue;

                var card = Instantiate(itemCardPrefab, itemsContainer);
                var itemComp = card.GetComponent<ItemCard>();
                itemComp.Setup(entry);
            }
        }

        private void RefreshSlots()
        {
            foreach (Transform child in slotsContainer) Destroy(child.gameObject);

            if (Store.activeShip == null) return;

            foreach (var slot in Store.activeShip.slots)
            {
                var tile = Instantiate(slotTilePrefab, slotsContainer);
                var slotComp = tile.GetComponent<SlotTile>();
                slotComp.Setup(slot, Store.catalog);
            }
        }

        private void RefreshHolds()
        {
            foreach (Transform child in holdsContainer) Destroy(child.gameObject);

            if (Store.activeShip == null) return;

            foreach (var hold in Store.activeShip.holds)
            {
                var tile = Instantiate(holdTilePrefab, holdsContainer);
                var holdComp = tile.GetComponent<HoldTile>();
                holdComp.Setup(hold, Store.catalog);
            }
        }

        private void RefreshShips()
        {
            foreach (Transform child in shipsContainer) Destroy(child.gameObject);

            foreach (var ship in Store.userShips)
            {
                var card = Instantiate(shipCardPrefab, shipsContainer);
                var shipComp = card.GetComponent<ShipCard>();
                shipComp.Setup(ship, Store.catalog);
            }
        }

        private bool MatchesCategory(Data.CatalogSO.Entry entry)
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

        private bool MatchesSubcategory(Data.CatalogSO.Entry entry)
        {
            if (string.IsNullOrEmpty(AppState.selectedSubcategory)) return true;
            return entry.category != null && entry.category.Name == AppState.selectedSubcategory;
        }
    }
}
