import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const navigate = useNavigate();

    function handleContinueClick(){
        if (email === 'admin@alertroad.com' || password === 'password123') {
            console.log('Login successful');
            setErrorMessage('');
            navigate('/dashboard');
        } else {
            setErrorMessage('Invalid email or password');
        }
    }

    return(
        <div>
            <h1>Log In</h1>

            <label>Email</label>
            <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
            />

            <label>Password</label>
            <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />

            {errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}

            <button onClick={handleContinueClick}>Continue</button>
        </div>
    );
}

export default LoginPage;