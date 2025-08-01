
const cassandra = require('cassandra-driver')

async function connect() {
    const cluster = new cassandra.Client({
        contactPoints: ["node-0.aws-ap-south-2.9abd6d5333579476490b.clusters.scylla.cloud", "node-1.aws-ap-south-2.9abd6d5333579476490b.clusters.scylla.cloud", "node-2.aws-ap-south-2.9abd6d5333579476490b.clusters.scylla.cloud"],
        localDataCenter: 'AWS_AP_SOUTH_2',
        credentials: {username: 'scylla', password: 'p2tsbkwIS6Q4y'},
        // keyspace: 'your_keyspace'
    })

    const results = await cluster.execute('SELECT * FROM system.clients LIMIT 10')
    results.rows.forEach(row => console.log(JSON.stringify(row)))

    await cluster.shutdown()
}

connect()