import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@mui/material/Button';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import Avatar from '@mui/material/Avatar';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { AuthContext } from '../contexts/AuthContext';
import { deepOrange } from '@mui/material/colors';

const defaultTheme = createTheme();

export default function Dashboard() {
    const navigate = useNavigate();
    const { handleLogout, userData } = useContext(AuthContext);

    const handleJoinMeeting = () => {
        // Generate a random room ID or ask user for input - for now, just navigate to a "room"
        navigate('/room123');
    };

    return (
        <ThemeProvider theme={defaultTheme}>
            <Container component="main" maxWidth="md">
                <CssBaseline />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3, mb: 5 }}>
                    <Typography variant="h5" component="h1" fontWeight="bold">
                        VideoMeetZ
                    </Typography>
                    {userData && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                        <Avatar sx={{ bgcolor: deepOrange[500] }}>
                                {userData.username ? userData.username[0].toUpperCase() : "U"}
                            </Avatar>
                            <Typography variant="subtitle1" fontWeight="medium">
                                {userData.name}
                            </Typography>

                        </Box>
                    )}
                </Box>
                <Box
                    sx={{
                        marginTop: 4,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                    }}
                >
                    <Typography component="h1" variant="h2" gutterBottom>
                        Welcome {userData?.name}
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
                            onClick={handleLogout}
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
