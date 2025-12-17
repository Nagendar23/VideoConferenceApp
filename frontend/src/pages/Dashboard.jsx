import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@mui/material/Button';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import { createTheme, ThemeProvider } from '@mui/material/styles';

const defaultTheme = createTheme();

export default function Dashboard() {
    const navigate = useNavigate();

    const handleJoinMeeting = () => {
        // Generate a random room ID or ask user for input - for now, just navigate to a "room"
        navigate('/room123');
    };

    return (
        <ThemeProvider theme={defaultTheme}>
            <Container component="main" maxWidth="md">
                <CssBaseline />
                <Box
                    sx={{
                        marginTop: 8,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                    }}
                >
                    <Typography component="h1" variant="h2" gutterBottom>
                        Welcome to Dashboard
                    </Typography>
                    <Typography variant="h5" align="center" color="text.secondary" paragraph>
                        You are now logged in. Start a video call or join a meeting using the button below.
                    </Typography>
                    <Box sx={{ mt: 4 }}>
                        <Button
                            variant="contained"
                            color="primary"
                            size="large"
                            onClick={handleJoinMeeting}
                        >
                            Join a Meeting
                        </Button>
                        <Button
                            variant="outlined"
                            color="secondary"
                            size="large"
                            onClick={() => {
                                localStorage.removeItem("token");
                                navigate("/auth");
                            }}
                            sx={{ ml: 2 }}
                        >
                            Logout
                        </Button>
                    </Box>
                </Box>
            </Container>
        </ThemeProvider>
    );
}
