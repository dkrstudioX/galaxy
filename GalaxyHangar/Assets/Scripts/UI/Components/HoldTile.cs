using UnityEngine;
using UnityEngine.UI;
using Galaxy.Hangar.Data;
using Galaxy.Hangar.Economy;

namespace Galaxy.Hangar.UI
{
    public class HoldTile : MonoBehaviour
    {
        [Header("UI Elements")]
        public Text holdNameText;
        public Text massText;
        public Transform contentsContainer;
        public GameObject contentItemPrefab;

        private HoldEntry holdData;
        private CatalogSO catalog;

        public void Setup(HoldEntry hold, CatalogSO cat)
        {
            holdData = hold;
            catalog = cat;
            UpdateVisual();
        }

        private void UpdateVisual()
        {
            holdNameText.text = holdData.name;
            var currentMass = 0;
            foreach (var id in holdData.contents)
            {
                var item = catalog.GetById(id);
                if (item != null) currentMass += item.mass;
            }
            massText.text = currentMass + " / " + holdData.capacity + " \u043a\u0433";

            foreach (Transform child in contentsContainer) Destroy(child.gameObject);

            for (int i = 0; i < holdData.contents.Count; i++)
            {
                var id = holdData.contents[i];
                var item = catalog.GetById(id);
                if (item == null) continue;

                var contentObj = Instantiate(contentItemPrefab, contentsContainer);
                var text = contentObj.GetComponent<Text>();
                if (text != null)
                {
                    text.text = item.name + " (" + item.mass + " \u043a\u0433)";
                }
                var btn = contentObj.GetComponent<Button>();
                if (btn != null)
                {
                    var holdIndex = Store.activeShip.holds.IndexOf(holdData);
                    var contentIndex = i;
                    btn.onClick.AddListener(() =>
                    {
                        if (SellService.TrySellHold(holdIndex, contentIndex, out var error))
                        {
                            UpdateVisual();
                            FindObjectOfType<SceneSetup>()?.RefreshAll();
                        }
                        else
                        {
                            Debug.LogWarning("[HoldTile] \u041e\u0448\u0438\u0431\u043a\u0430: " + error);
                        }
                    });
                }
            }
        }
    }
}
