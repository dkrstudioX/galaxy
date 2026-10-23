using UnityEngine;
using UnityEngine.UI;
using Galaxy.Hangar.Data;
using Galaxy.Hangar.Economy;

namespace Galaxy.Hangar.UI
{
    public class SlotTile : MonoBehaviour
    {
        [Header("UI Elements")]
        public Image slotImage;
        public Text slotText;
        public Button slotButton;

        private SlotEntry slotData;
        private CatalogSO catalog;

        public void Setup(SlotEntry slot, CatalogSO cat)
        {
            slotData = slot;
            catalog = cat;
            UpdateVisual();

            slotButton.onClick.RemoveAllListeners();
            slotButton.onClick.AddListener(OnSlotClicked);
        }

        private void UpdateVisual()
        {
            if (string.IsNullOrEmpty(slotData.contentsId))
            {
                slotImage.color = new Color(0.2f, 0.2f, 0.3f, 0.5f);
                slotText.text = slotData.slotId;
                slotText.color = new Color(0.5f, 0.5f, 0.6f);
            }
            else
            {
                var item = catalog.GetById(slotData.contentsId);
                if (item != null)
                {
                    slotImage.color = new Color(0.3f, 0.5f, 0.7f, 0.8f);
                    slotText.text = item.name;
                    slotText.color = Color.white;
                    if (item.icon != null) slotImage.sprite = item.icon;
                }
            }
        }

        private void OnSlotClicked()
        {
            if (string.IsNullOrEmpty(slotData.contentsId)) return;

            var index = System.Array.IndexOf(Store.activeShip.slots.ToArray(), slotData);
            if (SellService.TrySellSlot(index, out var error))
            {
                UpdateVisual();
                FindObjectOfType<SceneSetup>()?.RefreshAll();
            }
            else
            {
                Debug.LogWarning("[SlotTile] \u041e\u0448\u0438\u0431\u043a\u0430: " + error);
            }
        }
    }
}
