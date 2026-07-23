export default function manifest() {
    return {
        name: 'Defense GPT - AI Exam Prep',
        short_name: 'Defense GPT',
        description: 'AI-powered preparation for NDA, CDS, AFCAT, Navy & SSB',
        start_url: '/',
        display: 'standalone',
        background_color: '#070e09',
        theme_color: '#070e09',
        icons: [
            {
                src: '/icon.svg',
                sizes: 'any',
                type: 'image/svg+xml'
            }
        ]
    }
}
