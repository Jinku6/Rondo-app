WITH seed_venues(canonical_name, normalized_name, address, city, province, latitude, longitude) AS (
  VALUES
    ('Campo Municipal de La Cañada', 'campo municipal de la canada', 'C. Inocencio Arias, s/n, 04120 La Cañada, Almería', 'Almería', 'Almería', 36.836740, -2.403130),
    ('Campo de Fútbol Los Molinos (Constantino López)', 'campo de futbol los molinos constantino lopez', 'C. Líbano, s/n, 04009 Almería', 'Almería', 'Almería', 36.850121, -2.444658),
    ('Campo de Fútbol Pavía (Pedro Pérez)', 'campo de futbol pavia pedro perez', 'C. Antonio Cano, 104, 04009 Almería', 'Almería', 'Almería', 36.850569, -2.447360),
    ('Estadio de la Juventud "Emilio Campra"', 'estadio de la juventud emilio campra', 'C. Isla de Fuerteventura, 9, 04007 Almería', 'Almería', 'Almería', 36.830316, -2.447300),
    ('Campo de Fútbol Zapillo', 'campo de futbol zapillo', 'Cam. Jaúl Bajo, 04007 Almería', 'Almería', 'Almería', 36.827591, -2.428238),
    ('Liceo Sport club', 'liceo sport club', 'C. Adolfo Marsillach, 12, 04007 Almería', 'Almería', 'Almería', 36.829561, -2.441071),
    ('Club Natación Almería', 'club natacion almeria', 'Cam. Jaúl Bajo, 3, 04007 Almería', 'Almería', 'Almería', 36.827204, -2.441511),
    ('Campo de Fútbol Ernesto Cotorruelo', 'campo de futbol ernesto cotorruelo', 'Vía Lusitana, 5, 28025 Madrid', 'Madrid', 'Madrid', 40.379683, -3.725843),
    ('Instalación Deportiva Canal de Isabel II', 'instalacion deportiva canal de isabel ii', 'Av. de Filipinas, 54, 28003 Madrid', 'Madrid', 'Madrid', 40.441648, -3.705208),
    ('Campo de Fútbol García de la Mata', 'campo de futbol garcia de la mata', 'C. de Ramírez de Arellano, s/n, Cdad. Lineal, 28043 Madrid', 'Madrid', 'Madrid', 40.449115, -3.654055),
    ('Polideportivo Municipal La Elipa', 'polideportivo municipal la elipa', 'C. del Alcalde Garrido Juaristi, 17, 28030 Madrid', 'Madrid', 'Madrid', 40.414334, -3.655937),
    ('Centro Deportivo Municipal Margot Moles', 'centro deportivo municipal margot moles', 'Paseo del Polideportivo, 3, 28032 Madrid', 'Madrid', 'Madrid', 40.409408, -3.603465),
    ('C.D. Municipal Rodríguez Sahagún', 'c d municipal rodriguez sahagun', 'C. Miramelindos, 5, Tetuán, 28039 Madrid', 'Madrid', 'Madrid', 40.469631, -3.708867),
    ('Campo de Fútbol San Cristóbal de los Ángeles', 'campo de futbol san cristobal de los angeles', 'C. de Rocafort, 9, 28021 Madrid', 'Madrid', 'Madrid', 40.341645, -3.688975),
    ('I.D.M. Santa Ana', 'i d m santa ana', 'Paseo de las Alamedillas, 5, 28034 Madrid', 'Madrid', 'Madrid', 40.498150, -3.696340),
    ('Camp de Futbol Municipal Vall d''Hebron', 'camp de futbol municipal vall d hebron', 'Carrer de la Granja Vella, 12-16, Horta-Guinardó, 08035 Barcelona', 'Barcelona', 'Barcelona', 41.426707, 2.146724),
    ('Camp de Futbol Municipal Narcís Sala', 'camp de futbol municipal narcis sala', 'Carrer de Santa Coloma, 33, 08030 Barcelona', 'Barcelona', 'Barcelona', 41.428922, 2.192544),
    ('Camp de Futbol CEM Horta', 'camp de futbol cem horta', 'Carrer de Feliu i Codina, 27, 08031 Barcelona', 'Barcelona', 'Barcelona', 41.433573, 2.161082),
    ('Campo de fútbol de Canyelles', 'campo de futbol de canyelles', 'Ctra. Alta de les Roquetes, 63, Horta-Guinardó, 08035 Barcelona', 'Barcelona', 'Barcelona', 41.440477, 2.158199),
    ('Camp de Futbol Municipal de la Verneda', 'camp de futbol municipal de la verneda', 'Carrer de l''Agricultura, 238, Sant Martí, 08020 Barcelona', 'Barcelona', 'Barcelona', 41.417709, 2.202000),
    ('Camp de Futbol Municipal de l''Energia', 'camp de futbol municipal de l energia', 'C. de la Energía, 31, Sants-Montjuïc, 08038 Barcelona', 'Barcelona', 'Barcelona', 41.359429, 2.135404),
    ('Camp de Futbol Municipal de l''Àliga', 'camp de futbol municipal de l aliga', 'Plaça d''Alfonso Comín, 1, Gràcia, 08023 Barcelona', 'Barcelona', 'Barcelona', 41.414186, 2.138079),
    ('Camp de Futbol Municipal Porta', 'camp de futbol municipal porta', 'Avinguda de Rio de Janeiro, Nou Barris, 08016 Barcelona', 'Barcelona', 'Barcelona', 41.436742, 2.180390),
    ('Campo de Fútbol Municipal de Nazaret', 'campo de futbol municipal de nazaret', 'Carrer de Fernando Morais de la Horra, s/n, Poblats Marítims, 46024 València, Valencia', 'Valencia', 'Valencia', 39.449355, -0.331543),
    ('Campo de Fútbol de Serranos', 'campo de futbol de serranos', 'Jardín del Turia, Tramo VI, Margen Derecho, La Zaidía, 46003 València, Valencia', 'Valencia', 'Valencia', 39.485886, -0.374642),
    ('Campo de Fútbol Tramo VI (Cauce del Turia)', 'campo de futbol tramo vi cauce del turia', 'Av. de Tirso de Molina, 18, Extramurs, 46035 València, Valencia', 'Valencia', 'Valencia', 39.477243, -0.395537),
    ('Campo de Fútbol Municipal de Beniferri', 'campo de futbol municipal de beniferri', 'Carrer de Favanella, 18, Pobles de l''Oest, 46035 València, Valencia', 'Valencia', 'Valencia', 39.493340, -0.406346),
    ('Campo Municipal de Fútbol de Malilla', 'campo municipal de futbol de malilla', 'Carrer de Bernat Descoll, 21, Quatre Carreres, 46026 València, Valencia', 'Valencia', 'Valencia', 39.451423, -0.375195),
    ('Campo de Fútbol Municipal de Benimaclet', 'campo de futbol municipal de benimaclet', 'Carrer de Daniel Balaciart, s/n, Benimaclet, 46020 València, Valencia', 'Valencia', 'Valencia', 39.481135, -0.354821),
    ('Campo Municipal de Fútbol Dr. Lluch', 'campo municipal de futbol dr lluch', 'Carrer del Bloc dels Portuaris, 25, Poblats Marítims, 46011 València, Valencia', 'Valencia', 'Valencia', 39.469215, -0.326666),
    ('Campo de Fútbol San Ignacio (El Palo)', 'campo de futbol san ignacio el palo', 'C. Practicante Fernández Alcolea, 59, Málaga-Este, 29018 Málaga', 'Málaga', 'Málaga', 36.719423, -4.355502),
    ('Campo de Fútbol Municipal Portada Alta', 'campo de futbol municipal portada alta', 'C. James Joyce, 47, Teatinos-Universidad, 29010 Málaga', 'Málaga', 'Málaga', 36.720936, -4.456938),
    ('Campo de Fútbol Roma Luz', 'campo de futbol roma luz', 'Av. de Isaac Peral, 22, Carretera de Cádiz, 29004 Málaga', 'Málaga', 'Málaga', 36.694912, -4.457017),
    ('Campo de Fútbol Pedro Berruezo', 'campo de futbol pedro berruezo', 'Calle Pintor Pepe Bornoi, 4, Carretera de Cádiz, 29004 Málaga', 'Málaga', 'Málaga', 36.697408, -4.440044),
    ('Campo de Fútbol de Carlinda', 'campo de futbol de carlinda', 'C. Galeno, 1, Bailén-Miraflores, 29010 Málaga', 'Málaga', 'Málaga', 36.729453, -4.445754),
    ('Centro Deportivo Malaka CF', 'centro deportivo malaka cf', 'C. Virgen de las Flores, 22, Cruz de Humilladero, 29007 Málaga', 'Málaga', 'Málaga', 36.720635, -4.443039),
    ('Polideportivo Guadaljaire', 'polideportivo guadaljaire', 'Av de Europa, 122, Carretera de Cádiz, 29003 Málaga', 'Málaga', 'Málaga', 36.697039, -4.458012),
    ('Ciudad Deportiva de Elche', 'ciudad deportiva de elche', 'Carrer Confrides, 2, 03202 Elx, Alicante', 'Elche', 'Alicante', 38.271715, -0.677035),
    ('Polideportivo Municipal de Altabix', 'polideportivo municipal de altabix', 'Carrer Josefina Manresa, 14, 03202 Elx, Alicante', 'Elche', 'Alicante', 38.277888, -0.675137),
    ('Polideportivo El Toscar', 'polideportivo el toscar', 'Carrer Sax, 3, 03206 Elx, Alicante', 'Elche', 'Alicante', 38.276090, -0.718602),
    ('Polideportivo Municipal Carrús', 'polideportivo municipal carrus', 'Carrer Victoria Kent, 28, 03206 Elx, Alicante', 'Elche', 'Alicante', 38.278379, -0.708450),
    ('Campo Municipal Antonio Solana', 'campo municipal antonio solana', 'C. Barítono Paco Latorre, 6, 03015 Alicante', 'Alicante', 'Alicante', 38.379115, -0.486162),
    ('Campo Municipal de Tómbola', 'campo municipal de tombola', 'C. Penáguila, s/n, 03009 Alicante', 'Alicante', 'Alicante', 38.370580, -0.501534),
    ('Polideportivo Municipal de San Blas', 'polideportivo municipal de san blas', 'C. de San Salvador, s/n, 03005 Alicante', 'Alicante', 'Alicante', 38.348760, -0.496214),
    ('Campo de Fútbol Florida Babel', 'campo de futbol florida babel', 'C. Vicente Chávarri, 21, 03007 Alicante', 'Alicante', 'Alicante', 38.340938, -0.509910)
)
INSERT INTO public.venues (
  canonical_name,
  normalized_name,
  address,
  city,
  province,
  country_code,
  latitude,
  longitude,
  source,
  provider,
  verification_status,
  confidence_score
)
SELECT
  canonical_name,
  normalized_name,
  address,
  city,
  province,
  'ES',
  latitude,
  longitude,
  'rondo',
  'admin',
  'rondo_verified',
  0.95
FROM seed_venues seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.venues existing
  WHERE existing.country_code = 'ES'
    AND existing.city = seed.city
    AND existing.normalized_name = seed.normalized_name
);
