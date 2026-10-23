using UnityEngine;
using UnityEngine.UI;
using Galaxy.Hangar.Data;
using Galaxy.Hangar.Economy;

namespace Galaxy.Hangar.UI
{
    public class ShipPanel : MonoBehaviour
    {
        [Header("Info")]
        public Text shipNameText;
        public Text creditsText;
        public Text massText;

        [Header("Slots")]
        public Transform slotsContainer;
        public GameObject slotTilePrefab;

        [Header("Holds")]
        public Transform holdsContainer;
        public GameObject holdTilePrefab;

        public void Refresh()
        {
            if (Store.activeShip == null)
            {
                shipNameText.text = "\u041d\u0435\u0442 \u043a\u043e\u0440\u0430\u0431\u043b\u044f";
                creditsText.text = "0";
                massText.text = "0 \u043a\u0433";
                foreach (Transform child in slotsContainer) Destroy(child.gameObject);
                foreach (Transform child in holdsContainer) Destroy(child.gameObject);
                return;
            }

            var shipEntry = Store.catalog.GetById(Store.activeShip.shipId);
            shipNameText.text = Store.activeShip.name;
            creditsText.text = Store.activeShip.credits.ToString("N0");
            massText.text = MassService.GetShipMass().ToString("N0") + " \u043a\u0433";

            RefreshSlots();
            RefreshHolds();
        }

        private void RefreshSlots()
        {
            foreach (Transform child in slotsContainer) Destroy(child.gameObject);

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

            foreach (var hold in Store.activeShip.holds)
            {
                var tile = Instantiate(holdTilePrefab, holdsContainer);
                var holdComp = tile.GetComponent<HoldTile>();
                holdComp.Setup(hold, Store.catalog);
            }
        }
    }
}
