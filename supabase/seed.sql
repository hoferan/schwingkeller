insert into public.venues (name, canton, address, lat, lng, indoor, outdoor, person, phone, website) values
('Schwingkeller Emmental','BE','Schlossstrasse 3, 3550 Langnau i. E.',46.9389,7.7869,true,true,'Hans Wüthrich','+41 34 402 11 22','schwingen-emmental.ch'),
('Turnhalle Schlossmatt','BE','Schlossmattstrasse 12, 3400 Burgdorf',47.0590,7.6280,true,false,'Ueli Gerber','+41 34 422 33 44','schwingklub-burgdorf.ch'),
('Schwinghalle Boden','BE','Dorfstrasse 23, 3715 Adelboden',46.4926,7.5610,true,true,'Peter Tschanz','+41 33 673 80 80','adelboden-schwingen.ch'),
('Eidg. Schwingkeller Willisau','LU','Schlossfeldstrasse 8, 6130 Willisau',47.1213,7.9925,true,true,'Sepp Bucher','+41 41 970 12 34','schwingen-willisau.ch'),
('Schwingerkeller Allmend','LU','Horwerstrasse 87, 6005 Luzern',47.0356,8.3060,true,false,'Bruno Felder','+41 41 360 55 66','schwingen-luzern.ch'),
('Brünig Schwinget Arena','OW','Brünigstrasse 1, 6078 Lungern',46.7870,8.1580,false,true,'Res Imfeld','+41 41 678 90 12','bruenig-schwinget.ch'),
('Mythen Schwingkeller','SZ','Schmiedgasse 5, 6430 Schwyz',47.0207,8.6530,true,true,'Toni Reichmuth','+41 41 811 22 33','schwingen-schwyz.ch'),
('Säntis Schwingkeller','AI','Weissbadstrasse 14, 9050 Appenzell',47.3300,9.4100,true,false,'Jakob Fässler','+41 71 787 11 22','schwingen-appenzell.ch');

-- Synthetic development data. Venue and contact names are invented, phone numbers follow an
-- obviously patterned form, and websites use the reserved .example TLD (RFC 2606) so none of them
-- resolves to a real site. Coordinates ARE real town positions, because the canton poster frames
-- itself from them and src/data/seedData.test.ts checks each one against its canton's bounds.
--
-- The spread is deliberate: Fribourg is dense enough to force the poster's label placement through
-- its left/above/below fallbacks and into dropping a name, since the two Fribourg-city rows sit
-- ~135m apart and their pins nearly touch at poster zoom. Freiburg-Süd carries a name long enough
-- to be ellipsized, Zürich is a second dense canton with a different shape, and Valais is wide
-- enough to exercise landscape framing.
insert into public.venues (name, canton, address, lat, lng, indoor, outdoor, person, phone, website) values
('Schwingkeller Freiburg-Altstadt','FR','Murtengasse 18, 1700 Fribourg',46.8065,7.1615,true,false,'Martin Aebischer','+41 26 300 11 22','sk-freiburg-altstadt.example'),
('Schwingkeller Freiburg-Süd und Umgebung Sensebezirk','FR','Bonnesfontaines 44, 1700 Fribourg',46.8075,7.1625,true,true,'Yves Chassot','+41 26 300 22 33','sk-freiburg-sued.example'),
('Turnhalle Cormanon','FR','Route de Cormanon 7, 1752 Villars-sur-Glâne',46.7920,7.1200,true,false,'Nicolas Berset','+41 26 300 33 44','th-cormanon.example'),
('Schwinghalle Grand-Pré','FR','Route du Grand-Pré 21, 1723 Marly',46.7770,7.1610,true,true,'Laurent Python','+41 26 300 44 55','sh-grandpre.example'),
('Halle Agy','FR','Route dAgy 9, 1763 Granges-Paccot',46.8250,7.1450,false,true,'Simon Jungo','+41 26 300 55 66','halle-agy.example'),
('Schwingkeller Düdingen','FR','Bahnhofstrasse 31, 3186 Düdingen',46.8490,7.1900,true,false,'Beat Riedo','+41 26 300 66 77','sk-duedingen.example'),
('Schwinghalle Schmitten','FR','Dorfmatte 5, 1716 Schmitten',46.8650,7.2600,true,true,'Reto Zbinden','+41 26 300 77 88','sh-schmitten.example'),
('Turnhalle Prehl','FR','Prehlstrasse 12, 3280 Murten',46.9280,7.1170,true,false,'Thomas Herren','+41 26 300 88 99','th-prehl.example'),
('Schwingkeller Broye','FR','Rue du Temple 14, 1470 Estavayer-le-Lac',46.8500,6.8470,true,true,'Pascal Marmy','+41 26 301 11 22','sk-broye.example'),
('Schwinghalle Glane','FR','Route de Billens 6, 1680 Romont',46.6950,6.9180,false,true,'Damien Deillon','+41 26 301 22 33','sh-glane.example'),
('Schwingkeller Gruyère','FR','Rue de Vevey 52, 1630 Bulle',46.6190,7.0570,true,true,'Gilles Ruffieux','+41 26 301 33 44','sk-gruyere.example'),
('Schwingkeller Altstetten','ZH','Badenerstrasse 620, 8048 Zürich',47.3910,8.4800,true,false,'Andrea Mettler','+41 44 500 11 22','sk-altstetten.example'),
('Turnhalle Eulachpark','ZH','Else-Züblin-Strasse 15, 8404 Winterthur',47.5000,8.7240,true,true,'Beat Kunz','+41 52 500 22 33','th-eulachpark.example'),
('Schwinghalle Buchholz','ZH','Winterthurerstrasse 80, 8610 Uster',47.3470,8.7210,true,false,'Marco Brunner','+41 44 500 33 44','sh-buchholz.example'),
('Halle Schönenwerd','ZH','Schönenwerdstrasse 4, 8953 Dietikon',47.4020,8.4000,false,true,'Sandro Frei','+41 44 500 44 55','halle-schoenenwerd.example'),
('Schwingkeller Unterland','ZH','Sonnenhof 11, 8180 Bülach',47.5210,8.5410,true,true,'Lukas Sieber','+41 44 500 55 66','sk-unterland.example'),
('Turnhalle Waldegg','ZH','Waldeggstrasse 3, 8810 Horgen',47.2600,8.5990,true,false,'Fabian Roth','+41 44 500 66 77','th-waldegg.example'),
('Schwingkeller Chablais','VS','Avenue de lEurope 8, 1870 Monthey',46.2540,6.9540,true,true,'Jerome Vannay','+41 27 500 11 22','sk-chablais.example'),
('Schwinghalle Valere','VS','Rue de lIndustrie 22, 1950 Sion',46.2330,7.3600,true,false,'Gregoire Fournier','+41 27 500 22 33','sh-valere.example'),
('Turnhalle Litternahalle','VS','Bahnhofstrasse 9, 3930 Visp',46.2940,7.8830,true,true,'Armin Zurbriggen','+41 27 500 33 44','th-litterna.example'),
('Schwingkeller Simplon','VS','Furkastrasse 18, 3900 Brig',46.3160,7.9880,false,true,'Daniel Imhof','+41 27 500 44 55','sk-simplon.example');
