using UnityEngine;
using UnityEngine.UI;
using Galaxy.Hangar.Economy;

namespace Galaxy.Hangar.UI
{
    public class ConsolePanel : MonoBehaviour
    {
        [Header("Console")]
        public Text selectedItemText;
        public Text totalPriceText;
        public Button buyButton;
        public Button sellButton;

        private string pendingBuyId = null;

        private void Awake()
        {
            buyButton.onClick.AddListener(OnBuyClicked);
            sellButton.onClick.AddListener(OnSellClicked);
        }

        public void Refresh()
        {
            selectedItemText.text = "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u043e\u0432\u0430\u0440";
            totalPriceText.text = "0";
            buyButton.interactable = false;
            sellButton.interactable = false;
            pendingBuyId = null;
        }

        public void SetPendingBuy(string itemId, int price)
        {
            pendingBuyId = itemId;
            var item = Store.catalog.GetById(itemId);
            selectedItemText.text = item?.name ?? itemId;
            totalPriceText.text = price.ToString("N0");
            buyButton.interactable = true;
            sellButton.interactable = false;
        }

        private void OnBuyClicked()
        {
            if (string.IsNullOrEmpty(pendingBuyId)) return;

            if (BuyService.TryBuy(pendingBuyId, out var error))
            {
                Debug.Log("[Console] \u041a\u0443\u043f\u043b\u0435\u043d\u043e: " + pendingBuyId);
                Refresh();
                FindObjectOfType<SceneSetup>()?.RefreshAll();
            }
            else
            {
                Debug.LogWarning("[Console] \u041e\u0448\u0438\u0431\u043a\u0430: " + error);
                ShowError(error);
            }
        }

        private void OnSellClicked()
        {
            Debug.Log("[Console] \u041f\u0440\u043e\u0434\u0430\u0436\u0430");
        }

        private void ShowError(string error)
        {
            var modal = GameObject.Find("BuyFailModal");
            if (modal != null)
            {
                modal.SetActive(true);
                var text = modal.transform.Find("ErrorMessage")?.GetComponent<Text>();
                if (text != null) text.text = error;
            }
        }
    }
}
