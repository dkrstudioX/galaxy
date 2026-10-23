using UnityEngine;
using UnityEngine.UI;
using Galaxy.Hangar.Data;

namespace Galaxy.Hangar.UI
{
    public class ShipCard : MonoBehaviour
    {
        [Header("UI Elements")]
        public Text shipNameText;
        public Text creditsText;
        public Button selectButton;

        private ShipRecord shipData;

        public void Setup(ShipRecord ship, CatalogSO catalog)
        {
            shipData = ship;
            shipNameText.text = ship.name;
            creditsText.text = ship.credits.ToString("N0");

            selectButton.onClick.RemoveAllListeners();
            selectButton.onClick.AddListener(() => OnSelectClicked());
        }

        private void OnSelectClicked()
        {
            Store.activeShip = shipData;
            Store.Save();
            Debug.Log("[ShipCard] \u0412\u044b\u0431\u0440\u0430\u043d \u043a\u043e\u0440\u0430\u0431\u043b\u044c: " + shipData.name);
            FindObjectOfType<SceneSetup>()?.RefreshAll();
        }
    }
}
