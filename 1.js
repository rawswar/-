var WidgetMetadata = {
    id: "test_minimal",
    title: "Minimal Test",
    version: "1.0.0",
    requiredVersion: "0.0.1",
    modules: [
        {
            title: "Test Module",
            functionName: "minimalTestFunc"
        }
    ]
};

async function minimalTestFunc(params = {}) {
    console.log("Minimal test function executed.");
    // Return an empty array conforming to the expected data structure
    return [];
}
