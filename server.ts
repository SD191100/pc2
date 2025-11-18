import  server from './src/app.js'
import { config } from './src/config/index.js';

const PORT = config.port || 3000


server.listen(PORT, () => {
  console.log(`server running on port ${PORT}`);
});
