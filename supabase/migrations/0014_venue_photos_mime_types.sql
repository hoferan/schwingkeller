-- Limits the venue-photos bucket to image types that every browser can show. The bucket is public,
-- and the upload form's accept="image/*" only filters the file picker, so an approved editor calling
-- the Storage API directly could store a text/html or image/svg+xml file there and have it served
-- from the project's domain.
--
-- Storage checks the content type the upload declares and serves the file under that same type.
-- It doesn't look at the bytes, but a file stored as image/png is never run as a page.
--
-- JPEG is what the client's compression writes. A photo of 5MB or less goes up unchanged with the
-- type the browser gave it, so the list also takes PNG, WebP, GIF and AVIF. HEIC and HEIF stay out:
-- only Safari can show them, and the iPhone file picker hands accept="image/*" a JPEG anyway.
-- SVG stays out because it can carry script.
--
-- Files already in the bucket keep their type; the list applies to new uploads.
--
-- Safe to run twice.
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
where id = 'venue-photos';
