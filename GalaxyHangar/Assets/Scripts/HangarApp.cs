using UnityEngine;
using UnityEngine.UI;
using Galaxy.Hangar.Data;
using Galaxy.Hangar.UI.Panels;

namespace Galaxy.Hangar.UI
{
    [RequireComponent(typeof(Canvas))]
    public class HangarApp : MonoBehaviour
    {
        public CatalogSO catalogSO;
        public CategorySO[] categorySOs;

        [Header("Panels")]
        public ShopPanel shopPanel;
        public ShipPanel shipPanel;
        public ConsolePanel consolePanel;
        public DockPanel dockPanel;

        [Header("Tabs")]
        public GameObject shopTab;
        public GameObject shipViewTab;
        public GameObject infoTab;

        [Header("Header")]
        public Text creditsText;
        public Text massText;

        private void Awake()
        {
            Store.Initialize(catalogSO, categorySOs);
            ShowTab(0);
        }

        private void Start()
        {
            RefreshUI();
        }

        private void Update()
        {
            if (creditsText != null)
                creditsText.text = Store.Credits.ToString("N0");
            if (massText != null)
                massText.text = MassService.GetShipMass().ToString("N0") + " \u043a\u0433";
        }

        public void OnShopTabClicked() => SwitchTab(0);
        public void OnShipTabClicked() => SwitchTab(1);
        public void OnInfoTabClicked() => SwitchTab(2);

        private void SwitchTab(int tab)
        {
            switch (tab)
            {
                case 0: ShowTab(0); break;
                case 1: ShowTab(1); break;
                case 2: ShowTab(2); break;
            }
            RefreshUI();
        }

        private void ShowTab(int tab)
        {
            shopTab.SetActive(tab == 0);
            shipViewTab.SetActive(tab == 1);
            infoTab.SetActive(tab == 2);
        }

        public void RefreshUI()
        {
            shopPanel?.Refresh();
            shipPanel?.Refresh();
            dockPanel?.Refresh();
            consolePanel?.Refresh();
        }
    }
}
