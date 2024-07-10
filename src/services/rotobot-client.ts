interface ApiRequestBody {
    initial_query: string;
    user_email: string;
    title: string;
  }
  
  interface ApiResponse {
    data: any; // Adjust this according to the actual response structure
  }
  
  export class RotobotClient {
    async fetchRotobotAnswer(requestBody: ApiRequestBody): Promise<string> {
      const response = await fetch('YOUR_API_URL/v1/main-chat-endpoint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
  
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
  
      const data = (await response.json()) as ApiResponse; // Type assertion here
      return data.data; // Adjust based on actual response structure
    }
  }
  