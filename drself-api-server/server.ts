import app from './app';

const PORT = process.env.PORT || 3013;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  // --- DEBUG: Print all registered routes (recursive) ---

});
