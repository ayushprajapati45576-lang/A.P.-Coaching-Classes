require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function addTeacher(email, plainPassword) {
    console.log(`Adding teacher: ${email}...`);
    try {
        const hashedPassword = await bcrypt.hash(plainPassword, 10);
        
        const { data, error } = await supabase.from('users').insert({
            email: email,
            password_hash: hashedPassword,
            role: 'teacher',
            is_approved: true
        });

        if (error) {
            console.error('Error adding teacher:', error.message);
        } else {
            console.log('✅ Teacher added successfully!');
        }
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

// Tomorrow, we just need to pass the real email and password here
// addTeacher('actual_email@example.com', 'actual_password');
