using UnityEngine;
using UnityEngine.UI;
using Galaxy.Hangar.Data;
using Galaxy.Hangar.Economy;

namespace Galaxy.Hangar.UI
{
    public class ItemCard : MonoBehaviour
    {
        [Header("UI Elements")]
        public Image iconImage;
        public Text nameText;
        public Text priceText;
        public Text massText;
        public Button buyButton;

        private CatalogSO.Entry item;

        public void Setup(CatalogSO.Entry entry)
        {
            item = entry;
            nameText.text = entry.name;
            priceText.text = entry.priceBuy.ToString("N0");
            massText.text = entry.mass + " \u043a\u0433";
            if (entry.icon != null) iconImage.sprite = entry.icon;

            buyButton.onClick.RemoveAllListeners();
            buyButton.onClick.AddListener(() => OnBuyClicked());
        }

        private void OnBuyClicked()
        {
            if (item == null) return;

            if (BuyService.TryBuy(item.id, out var error))
            {
                Debug.Log("[ItemCard] \u041a\u0443\u043f\u043b\u0435\u043d\u043e: " + item.name);
                FindObjectOfType<SceneSetup>()?.RefreshAll();
            }
            else
            {
                Debug.LogWarning("[ItemCard] \u041e\u0448\u0438\u0431\u043a\u0430: " + error);
                ShowError(error);
            }
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
