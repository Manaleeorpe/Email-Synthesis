import { OpenRouter } from '@openrouter/sdk';


async function callAPI(message, from, to) {
    const openRouter = new OpenRouter({
        apiKey: process.env.OPENAI_API_KEY,
        /*defaultHeaders: {
          'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.
          'X-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai.
        },*/
    });
    const completion = await openRouter.chat.send({
        model: 'openai/gpt-5.2',
        messages: [
            {
                role: 'user',
                content: `
                    Summarize the following email thread.

                    From: ${from}
                    To: ${to}

                    Message:
                    ${message}
                            `,
            },
        ],
        stream: false,
    });
    //console.log(completion.choices[0].message.content);
    return completion.choices[0].message.content

}

export default callAPI;