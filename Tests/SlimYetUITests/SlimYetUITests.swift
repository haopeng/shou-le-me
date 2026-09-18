import XCTest

@MainActor
final class SlimYetUITests: XCTestCase {
    private func launch(_ language: String = "en") -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["--preview-data", "-native.language", language, "-AppleLanguages", "(\(language))", "-AppleLocale", language == "zh" ? "zh_CN" : "en_US"]
        app.launch()
        return app
    }

    private func screenshot(_ name: String, app: XCUIApplication) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testEnglishJourneyAndWeightEntry() {
        let app = launch()
        XCTAssertTrue(app.buttons["personal.logWeight"].waitForExistence(timeout: 15))
        screenshot("01-journey-en", app: app)
        app.buttons["personal.logWeight"].tap()
        let weight = app.textFields["log.weight"]
        XCTAssertTrue(weight.waitForExistence(timeout: 5))
        weight.tap()
        weight.typeText("74.2")
        XCTAssertEqual(weight.value as? String, "74.2")
        XCTAssertTrue(app.buttons["log.save"].isEnabled)
        screenshot("02-log-en", app: app)
        app.buttons["Cancel"].tap()
    }

    func testGroupPrivacyTrendsAndActivity() {
        let app = launch()
        app.tabBars.buttons["Groups"].tap()
        XCTAssertTrue(app.buttons["group.preview-group"].waitForExistence(timeout: 5))
        app.buttons["group.preview-group"].tap()
        XCTAssertTrue(app.buttons["group.baseline"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.staticTexts["74.2 kg"].exists)
        screenshot("03-group-en", app: app)
        app.segmentedControls.buttons["Activity"].tap()
        XCTAssertTrue(app.staticTexts["Alex"].waitForExistence(timeout: 5))
        screenshot("04-activity-en", app: app)
        app.buttons["group.baseline"].tap()
        let field = app.textFields["baseline.weight"]
        XCTAssertTrue(field.waitForExistence(timeout: 5))
        XCTAssertEqual(field.value as? String, "Starting weight")
    }

    func testChineseTop5AndSettings() {
        let app = launch("zh")
        XCTAssertTrue(app.buttons["personal.logWeight"].waitForExistence(timeout: 15))
        screenshot("05-journey-zh", app: app)
        app.tabBars.buttons["Top5"].tap()
        XCTAssertTrue(app.staticTexts["Morning Crew"].waitForExistence(timeout: 5))
        screenshot("06-top5-zh", app: app)
        app.tabBars.buttons["设置"].tap()
        XCTAssertTrue(app.staticTexts["体重单位"].waitForExistence(timeout: 5))
        screenshot("07-settings-zh", app: app)
    }
}
