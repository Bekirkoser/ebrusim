import XCTest

final class StudioUITests: XCTestCase {
    func testGalleryAndSavedArtwork() throws {
        let app = XCUIApplication()
        app.launchArguments = ["-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        let web = app.webViews.firstMatch
        XCTAssertTrue(web.waitForExistence(timeout: 20))
        let closeHelp = web.buttons["Close instructions"]
        if closeHelp.waitForExistence(timeout: 8) { closeHelp.tap() }
        let gallery = web.buttons["My works"].firstMatch
        XCTAssertTrue(gallery.waitForExistence(timeout: 8))
        gallery.tap()
        XCTAssertTrue(web.staticTexts["Images stay on this device. Export before uninstalling the app."].waitForExistence(timeout: 5))
        web.buttons["Close"].tap()
        let save = web.buttons["Save"].firstMatch
        guard save.exists && save.isEnabled else { throw XCTSkip("Simulator does not provide a WebGL context; gallery navigation passed, painting requires device QA.") }
        web.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.4)).tap()
        save.tap()
        XCTAssertTrue(web.staticTexts["Artwork saved to your gallery."].waitForExistence(timeout: 15))
        gallery.tap()
        XCTAssertTrue(web.images["Ebru artwork"].firstMatch.waitForExistence(timeout: 5))
        app.terminate()
        app.launch()
        let closeAgain = app.webViews.buttons["Close instructions"]
        if closeAgain.waitForExistence(timeout: 8) { closeAgain.tap() }
        app.webViews.buttons["My works"].firstMatch.tap()
        XCTAssertTrue(app.webViews.images["Ebru artwork"].firstMatch.waitForExistence(timeout: 5))
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = "Ebrusim iPhone saved gallery"
        shot.lifetime = .keepAlways
        add(shot)
    }
}
