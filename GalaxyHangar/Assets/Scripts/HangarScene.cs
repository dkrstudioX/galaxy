using UnityEngine;
using UnityEngine.UI;
using Galaxy.Hangar.Data;
using Galaxy.Hangar.Economy;

namespace Galaxy.Hangar
{
    public class HangarScene : MonoBehaviour
    {
        public CatalogSO catalogSO;
        public CategorySO[] categorySOs;

        [Header("Header")]
        public Text creditsText;
        public Text massText;

        [Header("Tabs")]
        public Button shopTabBtn;
        public Button shipTabBtn;
        public Button infoTabBtn;

        [Header("Shop Panel")]
        public Transform shopItemsContainer;
        public Transform shopChipsContainer;
        public Button allTabBtn;
        public Button equipmentTabBtn;
        public Button resourcesTabBtn;
        public Button shipsTabBtn;

        [Header("Ship Panel")]
        public Transform shipSlotsContainer;
        public Transform shipHoldsContainer;
        public Text shipNameText;

        [Header("Dock Panel")]
        public Transform dockShipsContainer;

        [Header("Console")]
        public Text consoleItemText;
        public Text consolePriceText;
        public Button consoleBuyBtn;

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
            SetupUI();
            RefreshAll();
        }

        private void Update()
        {
            if (creditsText != null)
                creditsText.text = Store.Credits.ToString("N0");
            if (massText != null)
                massText.text = MassService.GetShipMass().ToString("N0") + " \u043a\u0433";
        }

        private void SetupUI()
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

            shopTabBtn.onClick.AddListener(() => RefreshAll());
            shipTabBtn.onClick.AddListener(() => RefreshAll());
            infoTabBtn.onClick.AddListener(() => RefreshAll());

            consoleBuyBtn.onClick.AddListener(() =>
            {
                if (string.IsNullOrEmpty(consoleItemText.text) || consoleItemText.text == "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u043e\u0432\u0430\u0440") return;
                Debug.Log("[Console] \u041f\u043e\u043a\u0443\u043f\u043a\u0430");
            });
        }

        private void RefreshAll()
        {
            RefreshChips();
            RefreshShopItems();
            RefreshShipPanel();
            RefreshDock();
        }

        private void RefreshChips()
        {
            foreach (Transform child in shopChipsContainer) Destroy(child.gameObject);

            if (AppState.currentCategory == AppState.Category.All) return;

            var rootCat = GetRootCategory();
            if (rootCat == null) return;

            foreach (var child in rootCat.Children)
            {
                if (child == null) continue;
                var chip = Instantiate(chipPrefab, shopChipsContainer);
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

        private void RefreshShopItems()
        {
            foreach (Transform child in shopItemsContainer) Destroy(child.gameObject);

            foreach (var entry in Store.catalog.Items)
            {
                if (entry == null) continue;
                if (!MatchesCategory(entry)) continue;
                if (!MatchesSubcategory(entry)) continue;

                var card = Instantiate(itemCardPrefab, shopItemsContainer);
                card.GetComponent<ItemCard>().Setup(entry);
            }
        }

        private void RefreshShipPanel()
        {
            foreach (Transform child in shipSlotsContainer) Destroy(child.gameObject);
            foreach (Transform child in shipHoldsContainer) Destroy(child.gameObject);

            if (Store.activeShip == null)
            {
                shipNameText.text = "\u041d\u0435\u0442 \u043a\u043e\u0440\u0430\u0431\u043b\u044f";
                return;
            }

            shipNameText.text = Store.activeShip.name;

            foreach (var slot in Store.activeShip.slots)
            {
                var tile = Instantiate(slotTilePrefab, shipSlotsContainer);
                tile.GetComponent<SlotTile>().Setup(slot, Store.catalog);
            }

            foreach (var hold in Store.activeShip.holds)
            {
                var tile = Instantiate(holdTilePrefab, shipHoldsContainer);
                tile.GetComponent<HoldTile>().Setup(hold, Store.catalog);
            }
        }

        private void RefreshDock()
        {
            foreach (Transform child in dockShipsContainer) Destroy(child.gameObject);

            foreach (var ship in Store.userShips)
            {
                var card = Instantiate(shipCardPrefab, dockShipsContainer);
                card.GetComponent<ShipCard>().Setup(ship, Store.catalog);
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
