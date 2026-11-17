import Foundation

/// Files are local, excluded from backup, and atomically replaced on save.
/// The JSON record is the index; creation dates never depend on file timestamps.
final class GalleryStore {
    struct Artwork: Codable {
        let id: String
        let createdAt: Double
        let data: String
        var dictionary: [String: Any] { ["id": id, "createdAt": createdAt, "data": data] }
    }
    private let directory: URL
    private let manager: FileManager
    static let maxBytes = 24 * 1024 * 1024

    init(directory: URL? = nil, manager: FileManager = .default) throws {
        self.manager = manager
        self.directory = try directory ?? manager.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true).appendingPathComponent("EbrusimArtworks", isDirectory: true)
        try manager.createDirectory(at: self.directory, withIntermediateDirectories: true)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var url = self.directory
        try url.setResourceValues(values)
    }

    static func decodeDataURL(_ value: String) throws -> Data {
        guard value.utf8.count <= maxBytes * 4 / 3 + 256,
              let comma = value.firstIndex(of: ","),
              value[..<comma].hasSuffix(";base64"),
              let data = Data(base64Encoded: String(value[value.index(after: comma)...])),
              !data.isEmpty, data.count <= maxBytes else { throw CocoaError(.fileReadCorruptFile) }
        return data
    }
    private func url(for id: String) throws -> URL {
        guard UUID(uuidString: id) != nil else { throw CocoaError(.fileReadInvalidFileName) }
        return directory.appendingPathComponent(id + ".json")
    }
    func save(dataURL: String) throws -> Artwork {
        let data = try Self.decodeDataURL(dataURL)
        guard dataURL.hasPrefix("data:image/png;base64,"), data.starts(with: [137, 80, 78, 71, 13, 10, 26, 10]) else { throw CocoaError(.fileReadCorruptFile) }
        let item = Artwork(id: UUID().uuidString, createdAt: Date().timeIntervalSince1970 * 1000, data: dataURL)
        try JSONEncoder().encode(item).write(to: url(for: item.id), options: [.atomic, .completeFileProtectionUnlessOpen])
        return item
    }
    func list() throws -> [Artwork] {
        try manager.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
            .filter { $0.pathExtension == "json" }
            .compactMap { try? JSONDecoder().decode(Artwork.self, from: Data(contentsOf: $0)) }
            .sorted { $0.createdAt > $1.createdAt }
    }
    func delete(id: String) throws { try manager.removeItem(at: url(for: id)) }
}
