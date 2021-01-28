import fs from 'fs';

const filePath = './src/db/db.json';

const getUsers = () => {
    let rewdata = fs.readFileSync(filePath);
    return JSON.parse(rewdata.toString()); 
};

const saveUsers = (data: any) => {
    fs.writeFileSync(filePath, JSON.stringify(data));
};

const findUser = (id: number, data?: []) => {
    const users = data ? data : getUsers();
    const user = users.find((el: any) => el.id === id);

    return user;
}

const findUserByUsername = (username: string, data?: []) => {
    const users = data ? data : getUsers();
    const user = users.find((el: any) => el.username === username);

    return user;
}

const findUserByIndex = (index: number, data?: []) => {
    const users = data ? data : getUsers();

    return users[index];
}

export {
    getUsers,
    saveUsers,
    findUser,
    findUserByUsername,
    findUserByIndex
}