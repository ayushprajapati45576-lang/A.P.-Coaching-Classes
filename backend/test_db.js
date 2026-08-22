const supabase = require('./config/supabase');
const bcrypt = require('bcrypt');

async function test() {
    console.log("Fetching user...");
    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', 'teacher@coaching.com')
        .single();
    
    if (error) {
        console.error("Error:", error);
        return;
    }
    console.log("User found:", user);

    const validPassword = await bcrypt.compare('teacher123', user.password_hash);
    console.log("Password valid:", validPassword);
}

test();
