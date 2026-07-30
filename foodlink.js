const FoodLinkAI = (() => {
    const form = document.getElementById("surplusForm");
    const cameraButton = document.getElementById("cameraButton");
    const photoInput = document.getElementById("photoInput");
    const photoPreview = document.getElementById("photoPreview");
    const storageChips = Array.from(document.querySelectorAll("[data-storage]"));
    const resultCard = document.getElementById("resultCard");
    const urgencyBadge = document.getElementById("urgencyBadge");
    const consensusShelfLife = document.getElementById("consensusShelfLife");
    const xgBoostValue = document.getElementById("xgBoostValue");
    const tensorFlowValue = document.getElementById("tensorFlowValue");
    const notesList = document.getElementById("notesList");

    const baseShelfLifeHours = {
        "Cooked Rice": 6,
        Curry: 5,
        Bread: 12,
        Dairy: 4,
        Fruits: 10,
        "Sealed Packets": 24
    };

    let selectedStorage = "Room Temperature";

    function estimateAmbientTemperature(storageCondition) {
        if (storageCondition === "Frozen") return -5;
        if (storageCondition === "Refrigerated") return 4;
        return 28;
    }

    function runXGBoostShelfLifeModel({ foodType, storageCondition }) {
        const baseHours = baseShelfLifeHours[foodType] || 6;
        const temperature = estimateAmbientTemperature(storageCondition);

        let modifier = 1;
        if (temperature >= 25) modifier = 0.55;
        if (temperature <= 4) modifier = 1.3;
        if (temperature < 0) modifier = 1.6;

        return Number((baseHours * modifier).toFixed(1));
    }

    function runTensorFlowSpoilageModel({ foodType, hasImage }) {
        const defaults = {
            "Cooked Rice": 5.4,
            Curry: 4.8,
            Bread: 11.2,
            Dairy: 3.7,
            Fruits: 9.1,
            "Sealed Packets": 20.5
        };

        const baseline = defaults[foodType] || 6;
        return Number((hasImage ? baseline : baseline - 1.5).toFixed(1));
    }

    function calculateConsensusShelfLife(xgBoostHours, tensorFlowHours) {
        return Number((((xgBoostHours + tensorFlowHours) / 2)).toFixed(1));
    }

    function getUrgencyBadge(hours) {
        if (hours < 2) return "Red";
        if (hours < 6) return "Amber";
        return "Green";
    }

    function renderUrgency(badge) {
        urgencyBadge.textContent = badge;
        urgencyBadge.className = "urgency-badge";

        if (badge === "Red") urgencyBadge.classList.add("urgency-red");
        if (badge === "Amber") urgencyBadge.classList.add("urgency-amber");
        if (badge === "Green") urgencyBadge.classList.add("urgency-green");
    }

    function predictFreshness({ foodType, storageCondition, hasImage }) {
        const xgBoostShelfLifeHours = runXGBoostShelfLifeModel({
            foodType,
            storageCondition
        });

        const tensorFlowShelfLifeHours = runTensorFlowSpoilageModel({
            foodType,
            hasImage
        });

        const consensusShelfLifeHours = calculateConsensusShelfLife(
            xgBoostShelfLifeHours,
            tensorFlowShelfLifeHours
        );

        return {
            xgBoostShelfLifeHours,
            tensorFlowShelfLifeHours,
            consensusShelfLifeHours,
            urgencyBadge: getUrgencyBadge(consensusShelfLifeHours),
            notes: [
                "XGBoost placeholder uses food type and storage temperature heuristics.",
                "TensorFlow CNN placeholder assumes image-based spoilage scoring.",
                "Consensus value averages both model outputs for triage."
            ]
        };
    }

    cameraButton.addEventListener("click", () => {
        photoInput.click();
    });

    photoInput.addEventListener("change", () => {
        const [file] = photoInput.files || [];
        if (!file) return;

        const objectUrl = URL.createObjectURL(file);
        photoPreview.src = objectUrl;
        photoPreview.classList.remove("hidden");
    });

    storageChips.forEach((chip) => {
        chip.addEventListener("click", () => {
            selectedStorage = chip.dataset.storage;
            storageChips.forEach((item) => item.classList.remove("active"));
            chip.classList.add("active");
        });
    });

    form.addEventListener("reset", () => {
        selectedStorage = "Room Temperature";
        storageChips.forEach((chip) => {
            chip.classList.toggle("active", chip.dataset.storage === selectedStorage);
        });
        photoPreview.src = "";
        photoPreview.classList.add("hidden");
        resultCard.classList.add("hidden");
    });

    form.addEventListener("submit", (event) => {
        event.preventDefault();

        const foodType = document.getElementById("foodType").value;
        const quantityKg = Number(document.getElementById("quantityKg").value);
        const cookTime = document.getElementById("cookTime").value;
        const hasImage = Boolean((photoInput.files || []).length);

        if (!quantityKg || quantityKg <= 0 || !cookTime) {
            window.alert("Enter a valid quantity and cook time.");
            return;
        }

        const result = predictFreshness({
            foodType,
            storageCondition: selectedStorage,
            hasImage
        });

        consensusShelfLife.textContent = `${result.consensusShelfLifeHours.toFixed(1)} hrs`;
        xgBoostValue.textContent = `${result.xgBoostShelfLifeHours.toFixed(1)} hrs`;
        tensorFlowValue.textContent = `${result.tensorFlowShelfLifeHours.toFixed(1)} hrs`;
        renderUrgency(result.urgencyBadge);

        notesList.innerHTML = "";
        result.notes.forEach((note) => {
            const li = document.createElement("li");
            li.textContent = note;
            notesList.appendChild(li);
        });

        resultCard.classList.remove("hidden");
    });

    return {
        predictFreshness
    };
})();
