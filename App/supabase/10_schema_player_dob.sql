-- ElleraApp — schema Supabase: data di nascita completa per i giocatori
--
-- Da eseguire UNA VOLTA nell'SQL Editor di Supabase, dopo tutti gli script precedenti.
--
-- Prima i giocatori avevano solo l'anno di nascita ("year"). Aggiunge una data di
-- nascita completa ("dob", opzionale — i giocatori gia' esistenti non ce l'hanno
-- finche' qualcuno non la imposta dalla scheda giocatore). La colonna "year"
-- resta e viene tenuta sincronizzata dal client ogni volta che si imposta "dob"
-- (serve ancora a filtri, export Excel e archivio stagioni, che continuano a
-- funzionare come prima).

alter table players add column if not exists dob date;
