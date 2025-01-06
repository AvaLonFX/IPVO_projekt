/*
"use client"; // Ovo mora biti prva linija u fajlu

import { useState } from 'react';
import { supabase } from '../lib/supabase'; // Pretpostavljam da već imaš konekciju ovdje

export default function SearchPlayers() {
  const [searchTerm, setSearchTerm] = useState<string>(''); // Čuva unos korisnika
  const [players, setPlayers] = useState<any[]>([]); // Čuva rezultat pretrage

  const handleSearch = async (term: string) => {
    setSearchTerm(term);

    // Ako je polje za pretragu prazno, očisti rezultate
    if (!term.trim()) {
      setPlayers([]);
      return;
    }

    try {
      // Supabase query za pretragu imena i prezimena
      const { data, error } = await supabase
        .from('Osnovno_NBA') // Naziv tablice
        .select('*')
        .ilike('PLAYER_LAST_NAME', `%${term}%`) // Pretraga prezimena
        .or(`PLAYER_FIRST_NAME.ilike.%${term}%`); // Ili pretraga imena

      if (error) {
        console.error('Error fetching players:', error);
        return;
      }

      setPlayers(data || []); // Postavi rezultate pretrage ili prazan niz
    } catch (err) {
      console.error('Unexpected error:', err);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>NBA Player Search</h1>
      <input
        type="text"
        placeholder="Search by name..."
        value={searchTerm}
        onChange={(e) => handleSearch(e.target.value)}
        style={{
          width: '100%',
          padding: '10px',
          fontSize: '16px',
          marginBottom: '20px',
          border: '1px solid #ccc',
          borderRadius: '5px',
        }}
      />

      {players.length > 0 ? (
        <ul style={{ listStyleType: 'none', padding: '0' }}>
          {players.map((player) => (
            <li
              key={player.PERSON_ID}
              style={{
                marginBottom: '10px',
                padding: '10px',
                border: '1px solid #eee',
                borderRadius: '5px',
                backgroundColor: '#f9f9f9',
              }}
            >
              <strong>
                {player.PLAYER_FIRST_NAME} {player.PLAYER_LAST_NAME}
              </strong>{' '}
              - {player.TEAM_NAME || 'No Team'}
            </li>
          ))}
        </ul>
      ) : (
        searchTerm && <p>No players found.</p> // Poruka ako nema rezultata
      )}
    </div>
  );
}
*/
"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase"; // Pretpostavljam da već imaš konfiguraciju Supabase

export default function SearchPlayers() {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [players, setPlayers] = useState<any[]>([]);

  const handleSearch = async (term: string) => {
    setSearchTerm(term);

    // Ako nema teksta u tražilici, očisti rezultate
    if (term === "") {
      setPlayers([]);
      return;
    }

    // Dohvaćanje podataka iz baze
    const { data, error } = await supabase
      .from("Osnovno_NBA") // Naziv tablice
      .select("*")
      .or(
        `PLAYER_FIRST_NAME.ilike.%${term}%,PLAYER_LAST_NAME.ilike.%${term}%`
      );

    if (error) {
      console.error("Error fetching players:", error);
      return;
    }

    // Ažuriraj rezultate
    setPlayers(data || []);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>NBA Player Search</h1>
      <input
        type="text"
        placeholder="Search by name..."
        value={searchTerm}
        onChange={(e) => handleSearch(e.target.value)}
        style={{ width: "100%", padding: "10px", fontSize: "16px", marginBottom: "20px" }}
      />

      {players.length > 0 ? (
        <ul style={{ listStyleType: "none", padding: "0" }}>
          {players.map((player) => (
            <li key={player.PERSON_ID} style={{ marginBottom: "10px" }}>
              {player.PLAYER_FIRST_NAME} {player.PLAYER_LAST_NAME} - {player.TEAM_NAME || "No Team"}
            </li>
          ))}
        </ul>
      ) : (
        <p>No players found.</p>
      )}
    </div>
  );
}
