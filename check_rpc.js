const fs = require('fs');
const https = require('https');

const url = "https://ehekzoioqvtweugemktn.supabase.co/rest/v1/?apikey=sb_publishable_5UovV268FdjHyEvr02e_gA_TMv_p15-";

const options = {
    headers: {
        'Authorization': 'Bearer sb_publishable_5UovV268FdjHyEvr02e_gA_TMv_p15-',
        'Accept': 'application/json'
    }
};

https.get(url, options, (res) => {
    let data = '';
    console.log('Status:', res.statusCode);

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            const spec = JSON.parse(data);
            const paths = spec.paths || {};
            const rpcPaths = Object.keys(paths).filter(p => p.startsWith('/rpc/get_tenant_dashboard_stats'));

            console.log('\nFound matching RPC paths:', rpcPaths);

            for (const p of rpcPaths) {
                console.log(`\nDetails for ${p}:`);
                const method = paths[p].post || paths[p].get;
                if (method && method.parameters) {
                    console.log(JSON.stringify(method.parameters, null, 2));
                } else {
                    console.log('No parameters found or no POST/GET method');
                }
            }

            if (rpcPaths.length === 0) {
                console.log('\nCould not find any RPC starting with get_tenant_dashboard_stats.');
                const allRpc = Object.keys(paths).filter(p => p.startsWith('/rpc/'));
                console.log(`Found ${allRpc.length} total RPCs.`);
                console.log('Sample RPCs:', allRpc.slice(0, 10));
            }

        } catch (e) {
            console.error('Error parsing JSON:', e.message);
        }
    });

}).on('error', (err) => {
    console.error('Error making request:', err.message);
});
