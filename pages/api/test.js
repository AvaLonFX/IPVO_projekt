import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  // Testni upit za dohvaćanje podataka iz tablice "Test"
  const { data, error } = await supabase.from('nbatest').select('*');

  if (error) {
    res.status(500).json({ error: error.message });
  } else {
    res.status(200).json(data);
  }
}
