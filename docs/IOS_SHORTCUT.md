# Share to School Hub from iPhone (Apple Shortcut)

Safari web apps can't appear in the iOS share sheet (Apple doesn't support the Web Share
Target API). Until a native iOS app exists, an Apple Shortcut does the same job.

> Status: the server endpoint is implemented and tested. The Shortcut itself has **not yet
> been tested on a physical iPhone**.

## 1. Create your personal key
School Hub → Connections (plug icon) → *Share from other apps* → *iPhone Shortcut keys* →
name it → **Create key**. Copy the key (starts with `shk_`). It's shown only once.

## 2. Build the Shortcut (Shortcuts app)
1. **+** → name it **School Hub**.
2. Tap the **ⓘ** (details) → turn on **Show in Share Sheet**. Accepted types: Images, PDFs, Text, Safari web pages.
3. Add action **Get Contents of URL**:
   - URL: `https://YOUR-APP/api/ingest`
   - Method: **POST**
   - Headers: `Authorization` = `Bearer shk_…your key…`
   - Request Body: **Form**
     - Add field → type **File**, key `files`, value **Shortcut Input**
4. Add action **Get Dictionary Value** → key `review_url` from **Contents of URL**.
5. Add action **Open URLs** (opens the review screen in Safari).

For text (e.g. sharing a selected message), add a second field of type **Text**, key `text`,
value **Shortcut Input**.

## 3. Use it
In any app (Photos, Kambu, MyParentView, Mail, a PDF viewer): Share → **School Hub**.
School Hub stores the item privately, reads it with AI, and opens the review screen.

## Security
- The key only allows *adding* items to your family; it can't read anything.
- Revoke it any time in Connections. Keys are stored hashed.
- Rate limit: 40 items per hour per parent.

## Future: native share extension
A native iOS app with a Share Extension (Swift, App Group + shared keychain for auth, upload
to the same `/api/ingest` endpoint) removes the Shortcut setup. Requires an Apple Developer
account ($99/yr), App Store review, and TestFlight for the pilot.
