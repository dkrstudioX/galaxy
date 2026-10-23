using UnityEngine;
using UnityEngine.UI;
using Galaxy.Hangar.State;
using Galaxy.Hangar.Economy;

namespace Galaxy.Hangar.UI
{
    public class AppUI : MonoBehaviour
    {
        [Header("Tabs")]
        public GameObject shopTab;
        public GameObject shipViewTab;
        public GameObject infoTab;

        [Header("Panels")]
        public ShopPanel shopPanel;
        public ShipPanel shipPanel;
        public ConsolePanel consolePanel;
        public DockPanel dockPanel;

        [Header("Header")]
        public Text creditsText;
        public Text massText;

        private void Start()
        {
            ShowTab(AppState.currentTab);
            RefreshUI();
        }

        private void Update()
        {
            if (creditsText != null)
                creditsText.text = Store.Credits.ToString("N0");
            if (massText != null)
                massText.text = MassService.GetShipMass().ToString("N0") + " кг";
        }

        public void OnShopTabClicked() => SwitchTab(AppState.Tab.Shop);
        public void OnShipTabClicked() => SwitchTab(AppState.Tab.ShipView);
        public void OnInfoTabClicked() => SwitchTab(AppState.Tab.Info);

        private void SwitchTab(AppState.Tab tab)
        {
            AppState.SetTab(tab);
            ShowTab(tab);
            RefreshUI();
        }

        private void ShowTab(AppState.Tab tab)
        {
            shopTab.SetActive(tab == AppState.Tab.Shop);
            shipViewTab.SetActive(tab == AppState.Tab.ShipView);
            infoTab.SetActive(tab == AppState.Tab.Info);
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
