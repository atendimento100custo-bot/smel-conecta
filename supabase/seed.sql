-- supabase/seed.sql
INSERT INTO polos (nome, tipo, bairro, endereco) VALUES
  ('Ginásio Poliesportivo Vanecina Freitas Henrique Vicente','Ginásio','Siderlândia','Av. Presidente Kennedy, nº 6090'),
  ('Arena Esportiva Profº Paulo Camargo de Melo','Arena','Aterrado','Praça Independência e Luz II, s/nº'),
  ('Mini Estádio Edgar de Carvalho','Mini Estádio','Ilha São João','Rua Alexandre Polastri Filho, nº 791'),
  ('Ginásio Poliesportivo Darcise José de Carvalho','Ginásio','Santo Agostinho','Rua Jaime Martins, nº 850'),
  ('Ginásio Poliesportivo José Alves "Zinho"','Ginásio','Santa Cruz','Av. dos Ex-Combatentes, s/nº'),
  ('Ginásio Poliesportivo Heth Lustoza Bastos','Ginásio','Vila Rica (Três Poços)','Rua Érika Berbet, nº 03'),
  ('Estádio Municipal Raulino de Oliveira','Estádio','Jardim Paraíba','Rua 539, s/nº'),
  ('Kartódromo Municipal de Volta Redonda','Kartódromo','Aero Clube','Av. Ministro Salgado Filho, s/nº'),
  ('Academia de Ginástica e Musculação da 3ª Idade Dr. Eljo Cândido de Oliveira','Academia','Jardim Paraíba','Rua 539, s/nº'),
  ('Ginásio Poliesportivo Amaro Inácio','Ginásio','Retiro','Av. Antônio de Almeida Gama, s/nº'),
  ('Complexo Esportivo Jornalista Oscar Cardoso','Complexo','Aero Clube','Av. Ministro Salgado Filho, s/nº'),
  ('Parque Aquático Municipal','Parque Aquático','Ilha São João','Rua Alexandre Polastri Filho, nº 791'),
  ('Centro de Artes Marciais Mestre Boa Viagem','Centro','Jardim Paraíba','Rua 539, s/nº'),
  ('Ginásio Poliesportivo Carlos Augusto Haasis Filho','Ginásio','Vila Rica (Jd. Tiradentes)','Rua 43 c/ Rua 35'),
  ('Ginásio Poliesportivo Abrahan Medina','Ginásio','Ponte Alta','Rua Triestes, s/nº'),
  ('Museu da Cidade de Volta Redonda Geci Vieira Gonçalves','Museu','Jardim Paraíba','Rua 539, s/nº'),
  ('Ginásio Poliesportivo Nery Miglioly','Ginásio','Açude I','Rua Vereador Acácio da Rocha, nº 82'),
  ('Ginásio Poliesportivo Gal. Euclydes Figueiredo','Ginásio','Ilha São João','Rua Alexandre Polastri Filho, nº 761'),
  ('Ginásio Municipal de Skate Fernando Schimdт','Ginásio','Jardim Tiradentes','Rua 848, s/nº'),
  ('Ginásio Poliesportivo Francisco Gomes do Nascimento','Ginásio','São Geraldo','Rua Cap. BL. Bragança, nº 888');

INSERT INTO modalidades (nome, categoria, emoji, faixas) VALUES
  ('Atletismo','Atletismo','🏃','{"Infantil","Adulto"}'),
  ('Yoga','Bem-estar','🧘','{"Adulto","Melhor Idade"}'),
  ('Natação','Aquático','🏊','{"Infantil","Adulto","Melhor Idade"}'),
  ('Futsal','Coletivo','⚽','{"Infantil","Adulto"}'),
  ('Judô','Luta','🥋','{"Infantil","Adulto"}'),
  ('Dança de Salão','Dança','💃','{"Adulto","Melhor Idade"}');
