import XCTest
@testable import Ebrusim

final class GalleryStoreTests: XCTestCase {
    private var directory: URL!
    private let png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII="
    override func setUpWithError() throws { directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString) }
    override func tearDownWithError() throws { try? FileManager.default.removeItem(at: directory) }
    func testSaveSurvivesNewStoreAndDelete() throws {
        let store = try GalleryStore(directory: directory)
        XCTAssertEqual(try store.list().count, 0)
        let item = try store.save(dataURL: png)
        let reopened = try GalleryStore(directory: directory)
        let saved = try XCTUnwrap(reopened.list().first)
        XCTAssertEqual(saved.id, item.id)
        XCTAssertEqual(saved.data, png)
        try reopened.delete(id: item.id)
        XCTAssertEqual(try store.list().count, 0)
    }
    func testRejectsInvalidAndTraversalInput() throws {
        let store = try GalleryStore(directory: directory)
        XCTAssertThrowsError(try store.save(dataURL: "data:image/png;base64,notbase64"))
        XCTAssertThrowsError(try store.save(dataURL: "data:text/plain;base64,aGVsbG8="))
        XCTAssertThrowsError(try store.delete(id: "../../outside"))
        XCTAssertEqual(try store.list().count, 0)
    }
}
